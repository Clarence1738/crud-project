<?php

namespace App\Http\Controllers;

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

    /** table, writable columns, read capability, create capability, update capability */
    private const MODULES = [
        'fields' => ['farm_fields', ['name', 'size_hectares', 'soil_type', 'status', 'notes'], 'view', 'manage-records', 'manage-records'],
        'activities' => ['crop_activities', ['crop_season_id', 'type', 'activity_date', 'cost_kes', 'notes'], 'view', 'record-activity', 'manage-records'],
        'health' => ['livestock_events', ['livestock_record_id', 'type', 'event_date', 'next_due_date', 'cost_kes', 'medicine', 'notes'], 'view', 'record-activity', 'manage-records'],
        'inventory' => ['inventory_items', ['name', 'category', 'unit', 'quantity', 'reorder_level', 'expires_on'], 'view', 'manage-records', 'manage-records'],
        'tasks' => ['farm_tasks', ['title', 'priority', 'due_date', 'status', 'assignee_id', 'notes'], 'view', 'manage-records', 'manage-records'],
        'equipment' => ['farm_equipment', ['name', 'category', 'status', 'next_service_date', 'maintenance_cost_kes'], 'view', 'manage-records', 'manage-records'],
        'finance' => ['farm_transactions', ['type', 'category', 'transaction_date', 'amount_kes', 'party', 'notes'], 'finance', 'finance', 'finance'],
    ];

    public function __construct(private readonly FarmAccess $access) {}

    public function index(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table, , $read] = $this->module($module);
        $this->access->authorize($request, $farm, $read);
        $rows = DB::table($table)->where('farm_id', $farm->id)->orderByDesc('created_at')->get();

        return response()->json(['data' => $this->withLabels($module, $farm, $rows)]);
    }

    public function store(Request $request, Farm $farm, string $module): JsonResponse
    {
        [$table, $columns, , $create] = $this->module($module);
        $this->access->authorize($request, $farm, $create);
        $data = $this->defaults($request->validate($this->rules($module, $farm)));
        $id = (string) Str::uuid();
        DB::table($table)->insert([...array_intersect_key($data, array_flip($columns)), 'id' => $id, 'farm_id' => $farm->id, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['data' => $this->find($module, $farm, $id)], 201);
    }

    public function update(Request $request, Farm $farm, string $module, string $record): JsonResponse
    {
        [$table, $columns, , , $update] = $this->module($module);
        $this->access->authorize($request, $farm, $update);
        abort_unless(DB::table($table)->where('id', $record)->where('farm_id', $farm->id)->exists(), 404);
        $data = $this->defaults($request->validate($this->rules($module, $farm)));
        DB::table($table)->where('id', $record)->where('farm_id', $farm->id)
            ->update([...array_intersect_key($data, array_flip($columns)), 'updated_at' => now()]);

        return response()->json(['data' => $this->find($module, $farm, $record)]);
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

        return response()->json(['data' => $this->find('tasks', $farm, $task)]);
    }

    private function defaults(array $data): array
    {
        foreach (['cost_kes', 'maintenance_cost_kes'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] === null) {
                $data[$key] = 0;
            }
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

    /** Adds readable names for linked crop seasons, animals, and task assignees. */
    private function withLabels(string $module, Farm $farm, Collection $rows): Collection
    {
        if ($module === 'activities') {
            $labels = DB::table('crop_seasons')->where('farm_id', $farm->id)->get(['id', 'crop', 'variety', 'field_name'])
                ->mapWithKeys(fn ($c) => [$c->id => trim("{$c->crop} ".($c->variety ?? ''))." · {$c->field_name}"]);

            return $rows->each(fn ($row) => $row->crop_label = $labels[$row->crop_season_id] ?? null);
        }
        if ($module === 'health') {
            $labels = DB::table('livestock_records')->where('farm_id', $farm->id)->get(['id', 'species', 'tag_number', 'group_name'])
                ->mapWithKeys(fn ($l) => [$l->id => ($l->tag_number ?? $l->group_name)." · {$l->species}"]);

            return $rows->each(fn ($row) => $row->animal_label = $labels[$row->livestock_record_id] ?? null);
        }
        if ($module === 'tasks') {
            $names = DB::table('users')->whereIn('id', $rows->pluck('assignee_id')->filter()->unique())->pluck('name', 'id');

            return $rows->each(fn ($row) => $row->assignee_name = $row->assignee_id ? ($names[$row->assignee_id] ?? null) : null);
        }

        return $rows;
    }

    private function rules(string $module, Farm $farm): array
    {
        $openCropSeason = Rule::exists('crop_seasons', 'id')->where('farm_id', $farm->id)
            ->whereNull('archived_at')->whereNotIn('status', ['Completed', 'Cancelled']);
        $activeAnimal = Rule::exists('livestock_records', 'id')->where('farm_id', $farm->id)
            ->whereNull('archived_at')->where('status', 'Active');
        $member = Rule::exists('farm_memberships', 'user_id')->where('farm_id', $farm->id);

        return match ($module) {
            'fields' => ['name' => ['required', 'string', 'max:100'], 'size_hectares' => ['required', 'numeric', 'gt:0'], 'soil_type' => ['nullable', 'string', 'max:80'], 'status' => ['required', Rule::in(['Available', 'In use', 'Resting'])], 'notes' => ['nullable', 'string', 'max:2000']],
            'activities' => ['crop_season_id' => ['required', 'uuid', $openCropSeason], 'type' => ['required', Rule::in(self::ACTIVITY_TYPES)], 'activity_date' => ['required', 'date_format:Y-m-d'], 'cost_kes' => ['nullable', 'numeric', 'min:0'], 'notes' => ['nullable', 'string', 'max:2000']],
            'health' => ['livestock_record_id' => ['required', 'uuid', $activeAnimal], 'type' => ['required', Rule::in(self::HEALTH_TYPES)], 'event_date' => ['required', 'date_format:Y-m-d'], 'next_due_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:event_date'], 'cost_kes' => ['nullable', 'numeric', 'min:0'], 'medicine' => ['nullable', 'string', 'max:120'], 'notes' => ['nullable', 'string', 'max:2000']],
            'inventory' => ['name' => ['required', 'string', 'max:120'], 'category' => ['required', 'string', 'max:40'], 'unit' => ['required', Rule::in(['kg', 'litres', 'tonnes', 'units'])], 'quantity' => ['required', 'numeric', 'min:0'], 'reorder_level' => ['required', 'numeric', 'min:0'], 'expires_on' => ['nullable', 'date']],
            'tasks' => ['title' => ['required', 'string', 'max:160'], 'priority' => ['required', Rule::in(['Low', 'Medium', 'High'])], 'due_date' => ['nullable', 'date'], 'status' => ['required', Rule::in(self::TASK_STATUSES)], 'assignee_id' => ['nullable', 'integer', $member], 'notes' => ['nullable', 'string', 'max:2000']],
            'equipment' => ['name' => ['required', 'string', 'max:120'], 'category' => ['required', 'string', 'max:60'], 'status' => ['required', Rule::in(['Operational', 'Maintenance', 'Out of service'])], 'next_service_date' => ['nullable', 'date'], 'maintenance_cost_kes' => ['nullable', 'numeric', 'min:0']],
            'finance' => ['type' => ['required', Rule::in(['Income', 'Expense'])], 'category' => ['required', 'string', 'max:60'], 'transaction_date' => ['required', 'date'], 'amount_kes' => ['required', 'numeric', 'gt:0'], 'party' => ['nullable', 'string', 'max:120'], 'notes' => ['nullable', 'string', 'max:2000']],
        };
    }
}
