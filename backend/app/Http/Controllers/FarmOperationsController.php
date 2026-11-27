<?php

namespace App\Http\Controllers;

use App\Farms\AuditLog;
use App\Farms\FarmAccess;
use App\Models\Farm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class FarmOperationsController extends Controller
{
    public const ACTIVITY_TYPES = ['Land preparation', 'Planting', 'Irrigation', 'Fertilizer', 'Spraying', 'Scouting', 'Weeding', 'Harvesting'];

    public const HEALTH_TYPES = ['Vaccination', 'Treatment', 'Diagnosis', 'Deworming', 'Check-up'];

    public const TASK_STATUSES = ['Open', 'In progress', 'Completed', 'Cancelled'];

    public const MOVEMENT_TYPES = ['Receipt', 'Issue', 'Transfer', 'Adjustment'];

    /**
     * table, writable columns, read capability, create capability, update capability, audit label.
     * A null create or update capability means the module does not allow that action.
     */
    private const MODULES = [
        'fields' => ['farm_fields', ['name', 'size_hectares', 'soil_type', 'status', 'notes'], 'view', 'manage-records', 'manage-records', 'Field'],
        'activities' => ['crop_activities', ['crop_season_id', 'type', 'activity_date', 'cost_kes', 'notes'], 'view', 'record-activity', 'manage-records', 'Crop activity'],
        'health' => ['livestock_events', ['livestock_record_id', 'type', 'event_date', 'next_due_date', 'cost_kes', 'medicine', 'notes'], 'view', 'record-activity', 'manage-records', 'Health event'],
        'inventory' => ['inventory_items', ['name', 'category', 'unit', 'quantity', 'reorder_level', 'expires_on'], 'view', 'manage-records', 'manage-records', 'Inventory item'],
        'tasks' => ['farm_tasks', ['title', 'priority', 'due_date', 'status', 'assignee_id', 'notes'], 'view', 'manage-records', 'manage-records', 'Task'],
        'equipment' => ['farm_equipment', ['name', 'category', 'status', 'next_service_date', 'maintenance_cost_kes'], 'view', 'manage-records', 'manage-records', 'Equipment'],
        'finance' => ['farm_transactions', ['type', 'category', 'transaction_date', 'amount_kes', 'party', 'notes'], 'finance', 'finance', 'finance', 'Finance'],
        'harvests' => ['crop_harvests', ['crop_season_id', 'harvest_date', 'quantity_kg', 'loss_kg', 'grade', 'destination', 'storage_location'], 'view', 'manage-records', 'manage-records', 'Harvest'],
        'incidents' => ['crop_incidents', ['crop_season_id', 'type', 'incident_date', 'affected_area_ha', 'loss_kg', 'description', 'corrective_action'], 'view', 'manage-records', 'manage-records', 'Crop incident'],
        'breeding' => ['breeding_events', ['female_id', 'sire', 'bred_on', 'method', 'pregnancy_result', 'expected_birth_on'], 'view', 'manage-records', 'manage-records', 'Breeding'],
        'births' => ['birth_events', ['dam_id', 'born_on', 'born_alive', 'born_dead', 'offspring', 'notes'], 'view', 'manage-records', 'manage-records', 'Birth'],
        'production' => ['livestock_measurements', ['livestock_record_id', 'measured_on', 'session', 'kind', 'value', 'unit'], 'view', 'record-activity', 'manage-records', 'Measurement'],
        'movements' => ['stock_movements', ['inventory_item_id', 'type', 'quantity', 'moved_on', 'location', 'supplier', 'reason'], 'view', 'record-activity', null, 'Stock movement'],
        'suppliers' => ['suppliers', ['name', 'kind', 'phone', 'email', 'products'], 'view', 'manage-records', 'manage-records', 'Supplier'],
        'locations' => ['stock_locations', ['name', 'kind', 'notes'], 'view', 'manage-records', 'manage-records', 'Stock location'],
        'maintenance' => ['maintenance_records', ['farm_equipment_id', 'serviced_on', 'work_done', 'provider', 'cost_kes', 'downtime_hours', 'next_service_date'], 'view', 'manage-records', 'manage-records', 'Maintenance'],
        'audit' => ['audit_events', [], 'manage-farm', null, null, 'Audit event'],
    ];

    /** Modules whose records may be deleted, and the capability needed. */
    private const DELETABLE = ['production' => 'manage-records'];

    public function __construct(private readonly FarmAccess $access, private readonly AuditLog $audit) {}

    public function index(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table, , $read] = $this->module($module);
        $this->access->authorize($request, $farm, $read);
        $rows = DB::table($table)->where('farm_id', $farm->id)
            ->orderByDesc($module === 'audit' ? 'occurred_at' : 'created_at')->limit($module === 'audit' ? 500 : 5000)->get();

        return response()->json(['data' => $this->withLabels($module, $farm, $rows)]);
    }

    public function store(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table, $columns, , $create, , $label] = $this->module($module);
        abort_if($create === null, 405, 'These records cannot be created directly.');
        $this->access->authorize($request, $farm, $create);
        $data = array_intersect_key($this->derived($module, $this->defaults($request->validate($this->rules($module, $farm)))), array_flip($columns));
        $id = (string) Str::uuid();

        $this->guardProduction($module, $farm, $data);
        DB::transaction(function () use ($request, $farm, $module, $table, $data, $id): void {
            $extra = match ($module) {
                'movements' => $this->applyMovement($request, $farm, $data),
                default => [],
            };
            DB::table($table)->insert([...$data, ...$extra, 'id' => $id, 'farm_id' => $farm->id, 'created_at' => now(), 'updated_at' => now()]);
            $this->afterSave($module, $farm, $data, null);
        });
        $row = $this->find($module, $farm, $id);
        $this->audit->record($request, $farm, 'Created', $label, $this->describe($module, $row));

        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, Farm $farm, string $module, string $record): JsonResponse
    {
        [$table, $columns, , , $update, $label] = $this->module($module);
        abort_if($update === null, 409, $module === 'movements'
            ? 'Stock movements cannot be edited. Record an adjustment to correct the balance.'
            : 'These records cannot be edited.');
        $this->access->authorize($request, $farm, $update);
        $before = DB::table($table)->where('id', $record)->where('farm_id', $farm->id)->first();
        abort_unless($before, 404);
        $data = array_intersect_key($this->derived($module, $this->defaults($request->validate($this->rules($module, $farm, $record)))), array_flip($columns));

        $this->guardProduction($module, $farm, $data, $record);
        DB::transaction(function () use ($farm, $module, $table, $record, $data, $before): void {
            DB::table($table)->where('id', $record)->where('farm_id', $farm->id)->update([...$data, 'updated_at' => now()]);
            $this->afterSave($module, $farm, $data, $before);
        });
        $row = $this->find($module, $farm, $record);
        $this->audit->record($request, $farm, 'Updated', $label, $this->describe($module, $row));

        return response()->json(['data' => $row]);
    }

    /**
     * Deletes a record outright. Only modules listed in DELETABLE allow it (production entries
     * made by mistake); other records are archived or corrected instead.
     */
    public function destroy(Request $request, Farm $farm, string $module, string $record): JsonResponse
    {
        [$table, , , , , $label] = $this->module($module);
        abort_unless(isset(self::DELETABLE[$module]), 405, 'These records cannot be deleted.');
        $this->access->authorize($request, $farm, self::DELETABLE[$module]);
        abort_unless(DB::table($table)->where('id', $record)->where('farm_id', $farm->id)->exists(), 404);
        $summary = $this->describe($module, $this->find($module, $farm, $record));
        DB::table($table)->where('id', $record)->where('farm_id', $farm->id)->delete();
        $this->audit->record($request, $farm, 'Deleted', $label, $summary);

        return response()->json(null, 204);
    }

    /** Owners and Managers may update any task; Workers only tasks assigned to them. */
    public function updateTaskStatus(Request $request, Farm $farm, string $task): JsonResponse
    {
        $role = $this->access->authorize($request, $farm);
        $row = DB::table('farm_tasks')->where('id', $task)->where('farm_id', $farm->id)->first();
        abort_unless($row, 404);
        abort_if(! FarmAccess::can($role, 'manage-records') && (int) $row->assignee_id !== $request->user()->id, 403, 'Only tasks assigned to you can be updated.');
        $data = $request->validate(['status' => ['required', Rule::in(self::TASK_STATUSES)]]);
        DB::table('farm_tasks')->where('id', $task)->update(['status' => $data['status'], 'updated_at' => now()]);
        $this->audit->record($request, $farm, 'Updated', 'Task', "{$row->title}: status {$row->status} to {$data['status']}");

        return response()->json(['data' => $this->find('tasks', $farm, $task)]);
    }

    /**
     * Applies a stock movement to the item balance (FS BR-08). The item row is locked so two
     * issues cannot both spend the same stock. Adjustments need Owner or Manager and a reason.
     */
    private function applyMovement(Request $request, Farm $farm, array $data): array
    {
        $item = DB::table('inventory_items')->where('id', $data['inventory_item_id'])->where('farm_id', $farm->id)->lockForUpdate()->first();
        $quantity = (float) $data['quantity'];
        if ($data['type'] === 'Adjustment') {
            abort_unless(FarmAccess::can($this->access->role($request, $farm), 'manage-records'), 403, 'Only Owners and Managers can adjust stock.');
        }
        $balance = (float) $item->quantity + match ($data['type']) {
            'Receipt' => $quantity,
            'Issue' => -$quantity,
            'Adjustment' => $quantity,
            'Transfer' => 0,
        };
        abort_if($balance < 0, 422, "Only {$item->quantity} {$item->unit} of {$item->name} is in stock.");
        DB::table('inventory_items')->where('id', $item->id)->update(['quantity' => $balance, 'updated_at' => now()]);

        return ['balance_after' => $balance, 'actor_id' => $request->user()->id];
    }

    /** Keeps related records in step: harvested kg on the season, next service on the equipment. */
    private function afterSave(string $module, Farm $farm, array $data, ?object $before): void
    {
        if ($module === 'harvests') {
            if ($before) {
                DB::table('crop_seasons')->where('id', $before->crop_season_id)->decrement('harvested_kg', (float) $before->quantity_kg);
            }
            DB::table('crop_seasons')->where('id', $data['crop_season_id'])->where('farm_id', $farm->id)->increment('harvested_kg', (float) $data['quantity_kg']);
        }
        if ($module === 'maintenance' && ! empty($data['next_service_date'])) {
            DB::table('farm_equipment')->where('id', $data['farm_equipment_id'])->where('farm_id', $farm->id)
                ->update(['next_service_date' => $data['next_service_date'], 'updated_at' => now()]);
        }
    }

    private function defaults(array $data): array
    {
        foreach (['cost_kes', 'maintenance_cost_kes', 'loss_kg', 'born_dead'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === null) {
                $data[$key] = 0;
            }
        }
        if (array_key_exists('session', $data) && $data['session'] === null) {
            $data['session'] = 'Whole day';
        }

        return $data;
    }

    /** A production day is either one whole-day total or session entries, never both. */
    private function guardProduction(string $module, Farm $farm, array $data, ?string $record = null): void
    {
        if ($module === 'production') {
            ProductionController::guardSessions($farm->id, [$data['livestock_record_id']], $data['measured_on'], $data['kind'], $data['session'] ?? 'Whole day', $record);
        }
    }

    /** Values the server sets itself: a measurement's unit follows its measure (eggs are counted). */
    private function derived(string $module, array $data): array
    {
        if ($module === 'production') {
            $data['unit'] = ProductionController::KINDS[$data['kind']];
        }

        return $data;
    }

    private function module(string $module): array
    {
        abort_unless(isset(self::MODULES[$module]), 404);

        return self::MODULES[$module];
    }

    private function find(string $module, Farm $farm, string $id): object
    {
        $row = DB::table(self::MODULES[$module][0])->where('id', $id)->first();

        return $this->withLabels($module, $farm, collect([$row]))->first();
    }

    /** A one line description of a record for the audit history. */
    private function describe(string $module, object $row): string
    {
        return match ($module) {
            'fields', 'inventory', 'equipment', 'suppliers', 'locations' => $row->name,
            'activities' => "{$row->type} on {$row->crop_label}",
            'health' => "{$row->type} for {$row->animal_label}",
            'tasks' => $row->title,
            'finance' => "{$row->type} KES ".number_format((float) $row->amount_kes, 2)." ({$row->category})",
            'harvests' => number_format((float) $row->quantity_kg, 0)." kg from {$row->crop_label}",
            'incidents' => "{$row->type} on {$row->crop_label}",
            'breeding' => "{$row->animal_label} bred ({$row->method})",
            'births' => "{$row->born_alive} born to {$row->animal_label}",
            'production' => "{$row->kind} {$row->value} {$row->unit} ({$row->session}) for {$row->animal_label}",
            'movements' => "{$row->type} of {$row->quantity} for {$row->item_label}, balance {$row->balance_after}",
            'maintenance' => "{$row->equipment_label}: ".Str::limit($row->work_done, 80),
            default => $module,
        };
    }

    /** Adds readable names for linked crop seasons, animals, items, equipment and people. */
    private function withLabels(string $module, Farm $farm, Collection $rows): Collection
    {
        $link = match ($module) {
            'activities', 'harvests', 'incidents' => ['crop_season_id', 'crop_label', 'crops'],
            'health', 'production' => ['livestock_record_id', 'animal_label', 'livestock'],
            'breeding' => ['female_id', 'animal_label', 'livestock'],
            'births' => ['dam_id', 'animal_label', 'livestock'],
            'movements' => ['inventory_item_id', 'item_label', 'items'],
            'maintenance' => ['farm_equipment_id', 'equipment_label', 'equipment'],
            default => null,
        };
        if ($link) {
            [$key, $field, $source] = $link;
            $labels = $this->labels($source, $farm);
            $rows->each(fn ($row) => $row->{$field} = $labels[$row->{$key}] ?? null);
        }
        if (in_array($module, ['tasks', 'movements', 'audit'], true)) {
            $key = $module === 'tasks' ? 'assignee_id' : 'actor_id';
            $field = $module === 'tasks' ? 'assignee_name' : 'actor_name';
            $names = DB::table('users')->whereIn('id', $rows->pluck($key)->filter()->unique())->pluck('name', 'id');
            $rows->each(fn ($row) => $row->{$field} = $row->{$key} ? ($names[$row->{$key}] ?? null) : null);
        }

        return $rows;
    }

    private function labels(string $source, Farm $farm): Collection
    {
        return match ($source) {
            'crops' => DB::table('crop_seasons')->where('farm_id', $farm->id)->get(['id', 'crop', 'variety', 'field_name'])
                ->mapWithKeys(fn ($c) => [$c->id => trim("{$c->crop} ".($c->variety ?? ''))." · {$c->field_name}"]),
            'livestock' => DB::table('livestock_records')->where('farm_id', $farm->id)->get(['id', 'species', 'tag_number', 'group_name'])
                ->mapWithKeys(fn ($l) => [$l->id => ($l->tag_number ?? $l->group_name)." · {$l->species}"]),
            'items' => DB::table('inventory_items')->where('farm_id', $farm->id)->pluck('name', 'id'),
            'equipment' => DB::table('farm_equipment')->where('farm_id', $farm->id)->pluck('name', 'id'),
        };
    }

    private function rules(string $module, Farm $farm, ?string $record = null): array
    {
        $openCropSeason = Rule::exists('crop_seasons', 'id')->where('farm_id', $farm->id)
            ->whereNull('archived_at')->whereNotIn('status', ['Completed', 'Cancelled']);
        $activeAnimal = Rule::exists('livestock_records', 'id')->where('farm_id', $farm->id)
            ->whereNull('archived_at')->where('status', 'Active');
        $member = Rule::exists('farm_memberships', 'user_id')->where('farm_id', $farm->id);
        $sameFarm = fn (string $table, string $column = 'id') => Rule::exists($table, $column)->where('farm_id', $farm->id);
        $uniqueName = fn (string $table) => Rule::unique($table, 'name')->where('farm_id', $farm->id)->ignore($record);
        $money = ['nullable', 'numeric', 'min:0', 'max:9999999999'];
        $date = ['required', 'date_format:Y-m-d'];
        $notes = ['nullable', 'string', 'max:2000'];

        return match ($module) {
            'fields' => ['name' => ['required', 'string', 'max:100'], 'size_hectares' => ['required', 'numeric', 'gt:0'], 'soil_type' => ['nullable', 'string', 'max:80'], 'status' => ['required', Rule::in(['Available', 'In use', 'Resting'])], 'notes' => $notes],
            'activities' => ['crop_season_id' => ['required', 'uuid', $openCropSeason], 'type' => ['required', Rule::in(self::ACTIVITY_TYPES)], 'activity_date' => $date, 'cost_kes' => $money, 'notes' => $notes],
            'health' => ['livestock_record_id' => ['required', 'uuid', $activeAnimal], 'type' => ['required', Rule::in(self::HEALTH_TYPES)], 'event_date' => $date, 'next_due_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:event_date'], 'cost_kes' => $money, 'medicine' => ['nullable', 'string', 'max:120'], 'notes' => $notes],
            'inventory' => ['name' => ['required', 'string', 'max:120'], 'category' => ['required', 'string', 'max:40'], 'unit' => ['required', Rule::in(['kg', 'litres', 'tonnes', 'units'])], 'quantity' => ['required', 'numeric', 'min:0'], 'reorder_level' => ['required', 'numeric', 'min:0'], 'expires_on' => ['nullable', 'date']],
            'tasks' => ['title' => ['required', 'string', 'max:160'], 'priority' => ['required', Rule::in(['Low', 'Medium', 'High'])], 'due_date' => ['nullable', 'date'], 'status' => ['required', Rule::in(self::TASK_STATUSES)], 'assignee_id' => ['nullable', 'integer', $member], 'notes' => $notes],
            'equipment' => ['name' => ['required', 'string', 'max:120'], 'category' => ['required', 'string', 'max:60'], 'status' => ['required', Rule::in(['Operational', 'Maintenance', 'Out of service'])], 'next_service_date' => ['nullable', 'date'], 'maintenance_cost_kes' => $money],
            'finance' => ['type' => ['required', Rule::in(['Income', 'Expense'])], 'category' => ['required', 'string', 'max:60'], 'transaction_date' => ['required', 'date'], 'amount_kes' => ['required', 'numeric', 'gt:0'], 'party' => ['nullable', 'string', 'max:120'], 'notes' => $notes],
            'harvests' => ['crop_season_id' => ['required', 'uuid', $openCropSeason], 'harvest_date' => $date, 'quantity_kg' => ['required', 'numeric', 'min:0'], 'loss_kg' => ['nullable', 'numeric', 'min:0'], 'grade' => ['required', Rule::in(['Grade 1', 'Grade 2', 'Reject'])], 'destination' => ['required', Rule::in(['Store', 'Sold', 'Home use', 'Seed'])], 'storage_location' => ['nullable', 'string', $sameFarm('stock_locations', 'name')]],
            'incidents' => ['crop_season_id' => ['required', 'uuid', $openCropSeason], 'type' => ['required', Rule::in(['Pest', 'Disease', 'Weather', 'Theft', 'Other'])], 'incident_date' => $date, 'affected_area_ha' => ['nullable', 'numeric', 'min:0'], 'loss_kg' => ['nullable', 'numeric', 'min:0'], 'description' => ['required', 'string', 'max:2000'], 'corrective_action' => $notes],
            'breeding' => ['female_id' => ['required', 'uuid', $activeAnimal], 'sire' => ['nullable', 'string', 'max:120'], 'bred_on' => $date, 'method' => ['required', Rule::in(['Natural', 'Artificial insemination'])], 'pregnancy_result' => ['required', Rule::in(['Pending', 'Confirmed', 'Not pregnant'])], 'expected_birth_on' => ['nullable', 'date_format:Y-m-d', 'after:bred_on']],
            'births' => ['dam_id' => ['required', 'uuid', $activeAnimal], 'born_on' => [...$date, 'before_or_equal:today'], 'born_alive' => ['required', 'integer', 'min:0', 'max:1000'], 'born_dead' => ['nullable', 'integer', 'min:0', 'max:1000'], 'offspring' => ['nullable', 'string', 'max:200'], 'notes' => $notes],
            'production' => ['livestock_record_id' => ['required', 'uuid', $activeAnimal], 'measured_on' => $date, 'session' => ['nullable', Rule::in(ProductionController::SESSIONS)], 'kind' => ['required', Rule::in(array_keys(ProductionController::KINDS))], 'value' => ['required', 'numeric', 'gt:0', 'max:99999', Rule::when(fn ($input) => $input->kind === 'Eggs', ['integer'])]],
            'movements' => ['inventory_item_id' => ['required', 'uuid', $sameFarm('inventory_items')], 'type' => ['required', Rule::in(self::MOVEMENT_TYPES)], 'quantity' => ['required', 'numeric', 'not_in:0', 'gte:-99999999', 'lte:99999999', Rule::when(fn ($input) => $input->type !== 'Adjustment', ['gt:0'])], 'moved_on' => $date, 'location' => ['nullable', 'string', $sameFarm('stock_locations', 'name'), Rule::requiredIf(fn () => request('type') === 'Transfer')], 'supplier' => ['nullable', 'string', $sameFarm('suppliers', 'name')], 'reason' => ['nullable', 'string', 'max:2000', Rule::requiredIf(fn () => request('type') === 'Adjustment')]],
            'suppliers' => ['name' => ['required', 'string', 'max:120', $uniqueName('suppliers')], 'kind' => ['required', Rule::in(['Supplier', 'Buyer'])], 'phone' => ['nullable', 'string', 'max:40'], 'email' => ['nullable', 'email', 'max:160'], 'products' => $notes],
            'locations' => ['name' => ['required', 'string', 'max:100', $uniqueName('stock_locations')], 'kind' => ['required', Rule::in(['Store', 'Shed', 'Cold room', 'Other'])], 'notes' => $notes],
            'maintenance' => ['farm_equipment_id' => ['required', 'uuid', $sameFarm('farm_equipment')], 'serviced_on' => $date, 'work_done' => ['required', 'string', 'max:2000'], 'provider' => ['nullable', 'string', 'max:120'], 'cost_kes' => $money, 'downtime_hours' => ['nullable', 'numeric', 'min:0', 'max:10000'], 'next_service_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:serviced_on']],
        };
    }
}
