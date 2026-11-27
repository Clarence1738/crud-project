<?php

namespace App\Http\Controllers;

use App\Farms\AuditLog;
use App\Farms\FarmAccess;
use App\Models\Farm;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Fast daily production entry (one value per animal on a single sheet) and the totals the
 * dashboard charts. Single measurements are still listed and edited in the "production" module.
 */
class ProductionController extends Controller
{
    public const KINDS = ['Milk' => 'litres', 'Eggs' => 'eggs', 'Weight' => 'kg', 'Wool' => 'kg'];

    public const SESSIONS = ['Morning', 'Midday', 'Evening', 'Whole day'];

    /** Measures that add up over a day; a weight is a reading, not a yield. */
    private const YIELDS = ['Milk', 'Eggs', 'Wool'];

    public function __construct(private readonly FarmAccess $access, private readonly AuditLog $audit) {}

    /**
     * A day is recorded either as one whole-day total or by session (Morning, Midday, Evening),
     * never both, so it is not counted twice. Sessions are independent: a morning entry does not
     * require an evening one. Returns, per animal, the entries that block the given session.
     *
     * @param  list<string>  $animalIds
     * @return Collection<string, list<string>>
     */
    public static function blockingSessions(string $farmId, array $animalIds, string $date, string $kind, string $session, ?string $ignoreId = null): Collection
    {
        return DB::table('livestock_measurements')->where('farm_id', $farmId)->whereIn('livestock_record_id', $animalIds)
            ->where('measured_on', $date)->where('kind', $kind)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->when($session === 'Whole day', fn ($q) => $q->where('session', '!=', 'Whole day'), fn ($q) => $q->where('session', 'Whole day'))
            ->get(['livestock_record_id', 'session'])
            ->groupBy('livestock_record_id')->map(fn ($rows) => $rows->pluck('session')->unique()->values()->all());
    }

    /** Stops a save that would mix a whole-day total with session entries for the same day. */
    public static function guardSessions(string $farmId, array $animalIds, string $date, string $kind, string $session, ?string $ignoreId = null): void
    {
        $blocked = self::blockingSessions($farmId, $animalIds, $date, $kind, $session, $ignoreId);
        if ($blocked->isEmpty()) {
            return;
        }
        $names = DB::table('livestock_records')->whereIn('id', $blocked->keys())->get(['id', 'tag_number', 'group_name'])
            ->map(fn ($a) => $a->tag_number ?? $a->group_name)->sort()->implode(', ');
        abort(422, $session === 'Whole day'
            ? "{$names} already ".($blocked->count() === 1 ? 'has' : 'have')." {$kind} recorded by session on {$date}, so a whole-day total cannot be added. Use the session entries, or delete them first."
            : "{$names} already ".($blocked->count() === 1 ? 'has' : 'have')." a whole-day {$kind} total on {$date}, so sessions cannot be added. Delete the whole-day entry first to record by session.");
    }

    /** Active animals with the value already recorded for this date, session and measure, and the previous one. */
    public function sheet(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);
        $slot = $request->validate($this->slotRules());
        $animals = DB::table('livestock_records')->where('farm_id', $farm->id)->whereNull('archived_at')->where('status', 'Active')
            ->orderBy('species')->orderBy('tag_number')->orderBy('group_name')
            ->get(['id', 'tag_number', 'group_name', 'species', 'sex', 'tracking_type', 'quantity']);
        $current = $this->slot($farm, $slot)->pluck('value', 'livestock_record_id');
        $last = DB::table('livestock_measurements')->where('farm_id', $farm->id)->where('kind', $slot['kind'])
            ->where('session', $slot['session'])->where('measured_on', '<', $slot['measured_on'])
            ->orderByDesc('measured_on')->get(['livestock_record_id', 'value'])
            ->unique('livestock_record_id')->pluck('value', 'livestock_record_id');
        $blocked = self::blockingSessions($farm->id, $animals->pluck('id')->all(), $slot['measured_on'], $slot['kind'], $slot['session']);

        return response()->json(['data' => $animals->map(fn ($a) => [
            'blocked_by' => $blocked[$a->id] ?? null,
            'id' => $a->id,
            'label' => ($a->tag_number ?? $a->group_name).($a->tracking_type === 'Group' ? " ({$a->quantity})" : ''),
            'species' => $a->species,
            'sex' => $a->sex,
            'value' => isset($current[$a->id]) ? (float) $current[$a->id] : null,
            'last' => isset($last[$a->id]) ? (float) $last[$a->id] : null,
        ])->values()]);
    }

    /**
     * Saves a whole sheet in one transaction; blank values are skipped. Changing a value that
     * is already recorded is a correction, so it needs Owner or Manager like any other edit.
     */
    public function saveSheet(Request $request, Farm $farm): JsonResponse
    {
        $role = $this->access->authorize($request, $farm, 'record-activity');
        $data = $request->validate([...$this->slotRules(),
            'entries' => ['required', 'array', 'min:1', 'max:500'],
            'entries.*.livestock_record_id' => ['required', 'uuid', 'distinct', Rule::exists('livestock_records', 'id')
                ->where('farm_id', $farm->id)->whereNull('archived_at')->where('status', 'Active')],
            'entries.*.value' => ['nullable', 'numeric', 'gt:0', 'max:99999', Rule::when(fn ($input) => $input->kind === 'Eggs', ['integer'])],
        ]);
        $entries = collect($data['entries'])->filter(fn ($e) => isset($e['value']) && $e['value'] !== '')->values();
        abort_if($entries->isEmpty(), 422, 'Enter at least one value.');
        self::guardSessions($farm->id, $entries->pluck('livestock_record_id')->all(), $data['measured_on'], $data['kind'], $data['session']);
        $existing = $this->slot($farm, $data)->keyBy('livestock_record_id');
        $changes = $entries->filter(fn ($e) => isset($existing[$e['livestock_record_id']])
            && (float) $existing[$e['livestock_record_id']]->value !== (float) $e['value']);
        abort_if($changes->isNotEmpty() && ! FarmAccess::can($role, 'manage-records'), 403,
            'Some values are already recorded. Only Owners and Managers can correct them.');

        $unit = self::KINDS[$data['kind']];
        DB::transaction(function () use ($farm, $data, $entries, $existing, $unit): void {
            foreach ($entries as $entry) {
                $row = $existing[$entry['livestock_record_id']] ?? null;
                if ($row) {
                    DB::table('livestock_measurements')->where('id', $row->id)->update(['value' => $entry['value'], 'updated_at' => now()]);

                    continue;
                }
                DB::table('livestock_measurements')->insert([
                    'id' => (string) Str::uuid(), 'farm_id' => $farm->id, 'livestock_record_id' => $entry['livestock_record_id'],
                    'measured_on' => $data['measured_on'], 'session' => $data['session'], 'kind' => $data['kind'],
                    'value' => $entry['value'], 'unit' => $unit, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        });
        $total = round($entries->sum(fn ($e) => (float) $e['value']), 2);
        $this->audit->record($request, $farm, $changes->isEmpty() ? 'Created' : 'Updated', 'Production sheet',
            "{$data['kind']} {$data['measured_on']} {$data['session']}: {$entries->count()} entries, {$total} {$unit}");

        return response()->json(['data' => ['saved' => $entries->count(), 'corrected' => $changes->count(), 'total' => $total, 'unit' => $unit]]);
    }

    /**
     * Daily totals per measure for the dashboard chart, oldest day first. Each day is split by
     * session and by animal type ("species:Goats"), so cow and goat milk can be told apart.
     */
    public function summary(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);
        $days = (int) ($request->validate(['days' => ['nullable', 'integer', 'min:7', 'max:90']])['days'] ?? 14);
        $today = CarbonImmutable::now('Africa/Nairobi')->startOfDay();
        $from = $today->subDays($days - 1);
        // Two full weeks before today, for the weekly comparison.
        $start = $today->subDays(max($days, 15) - 1);
        $rows = DB::table('livestock_measurements as m')->join('livestock_records as l', 'l.id', '=', 'm.livestock_record_id')
            ->where('m.farm_id', $farm->id)->whereIn('m.kind', self::YIELDS)
            ->whereBetween('m.measured_on', [$start->toDateString(), $today->toDateString()])
            ->groupBy('m.kind', 'm.measured_on', 'm.session', 'l.species')
            ->get(['m.kind', 'm.measured_on', 'm.session', 'l.species', DB::raw('sum(m.value) as total')]);

        // Animals recorded each day of the last week. Today and yesterday give the "recorded" counts;
        // the whole week gives the animals currently in production (being milked or laying), which
        // leaves out calves, dry cows and meat animals without any setup.
        $recorded = DB::table('livestock_measurements as m')->join('livestock_records as l', 'l.id', '=', 'm.livestock_record_id')
            ->where('m.farm_id', $farm->id)->whereIn('m.kind', self::YIELDS)
            ->whereBetween('m.measured_on', [$today->subDays(7)->toDateString(), $today->toDateString()])
            ->distinct()->get(['m.kind', 'm.measured_on', 'l.species', 'l.id', 'l.quantity']);
        $herd = $recorded->unique(fn ($r) => $r->kind.'|'.$r->id)->values();

        $kinds = [];
        foreach (self::YIELDS as $kind) {
            $ofKind = $rows->where('kind', $kind);
            if ($ofKind->isNotEmpty()) {
                $trend = $this->trend($kind, $ofKind, $start, $today, $days);
                $trend['compare'] = $this->compare($ofKind, $trend['species'], $today, $recorded->where('kind', $kind), $herd->where('kind', $kind));
                $kinds[] = $trend;
            }
        }

        return response()->json(['data' => ['from' => $from->toDateString(), 'to' => $today->toDateString(), 'kinds' => $kinds]]);
    }

    private function trend(string $kind, Collection $rows, CarbonImmutable $from, CarbonImmutable $today, int $days): array
    {
        $species = $rows->pluck('species')->unique()->sort()->values()->all();
        $series = [];
        for ($day = $from; $day <= $today; $day = $day->addDay()) {
            $date = $day->toDateString();
            $ofDay = $rows->filter(fn ($r) => substr((string) $r->measured_on, 0, 10) === $date);
            $point = ['date' => $date, 'total' => round((float) $ofDay->sum('total'), 2)];
            foreach (self::SESSIONS as $session) {
                $point[$session] = round((float) $ofDay->where('session', $session)->sum('total'), 2);
            }
            foreach ($species as $name) {
                $point["species:{$name}"] = round((float) $ofDay->where('species', $name)->sum('total'), 2);
            }
            $series[] = $point;
        }
        // Today is usually still being recorded, so the weekly figures use complete days up to yesterday.
        $end = count($series) - 1;
        $week = array_slice($series, $end - 7, 7);
        $last7 = array_sum(array_column($week, 'total'));
        $prev7 = array_sum(array_column(array_slice($series, $end - 14, 7), 'total'));

        return [
            'kind' => $kind,
            'unit' => self::KINDS[$kind],
            'species' => $species,
            'series' => array_slice($series, -$days),
            'today' => end($series)['total'],
            'last7_average' => round($last7 / 7, 2),
            'by_species' => array_map(fn (string $name) => [
                'species' => $name,
                'today' => end($series)["species:{$name}"],
                'last7_average' => round(array_sum(array_column($week, "species:{$name}")) / 7, 2),
            ], $species),
            'change_percent' => $prev7 > 0 ? round(($last7 - $prev7) / $prev7 * 100, 1) : null,
        ];
    }

    /**
     * Today against yesterday for each animal type, plus an all-animals row when there is more
     * than one type. The change compares only the sessions already recorded today, so a morning
     * milking is not set against yesterday's morning and evening together.
     */
    private function compare(Collection $rows, array $species, CarbonImmutable $today, Collection $recorded, Collection $herd): array
    {
        $dates = ['today' => $today->toDateString(), 'yesterday' => $today->subDay()->toDateString()];
        $sum = fn (string $date, ?string $name, ?string $session = null) => round((float) $rows
            ->filter(fn ($r) => substr((string) $r->measured_on, 0, 10) === $date
                && ($name === null || $r->species === $name) && ($session === null || $r->session === $session))
            ->sum('total'), 2);
        $recordedOn = fn (string $date, ?string $name) => $recorded
            ->filter(fn ($r) => substr((string) $r->measured_on, 0, 10) === $date && ($name === null || $r->species === $name));
        // Records (an animal or a group) for the "recorded" count; heads for the per-animal yield.
        $animals = fn (string $date, ?string $name) => $recordedOn($date, $name)->count();
        $heads = fn (string $date, ?string $name) => (int) $recordedOn($date, $name)->sum('quantity');

        $groups = count($species) > 1 ? [...$species, null] : $species;

        return array_map(function (?string $name) use ($dates, $sum, $animals, $heads, $herd) {
            $sessions = [];
            $sameSessionsYesterday = 0.0;
            foreach (self::SESSIONS as $session) {
                $today = $sum($dates['today'], $name, $session);
                $yesterday = $sum($dates['yesterday'], $name, $session);
                if ($today > 0) {
                    $sameSessionsYesterday += $yesterday;
                }
                if ($today > 0 || $yesterday > 0) {
                    $sessions[] = ['session' => $session, 'today' => $today, 'yesterday' => $yesterday];
                }
            }
            $todayTotal = $sum($dates['today'], $name);
            $yesterdayTotal = $sum($dates['yesterday'], $name);
            $animalsYesterday = $animals($dates['yesterday'], $name);
            $headsYesterday = $heads($dates['yesterday'], $name);

            return [
                'species' => $name,
                'today' => $todayTotal,
                'yesterday' => $yesterdayTotal,
                'yesterday_same_sessions' => round($sameSessionsYesterday, 2),
                'change_percent' => $todayTotal > 0 && $sameSessionsYesterday > 0
                    ? round(($todayTotal - $sameSessionsYesterday) / $sameSessionsYesterday * 100, 1) : null,
                'sessions' => $sessions,
                'animals_today' => $animals($dates['today'], $name),
                'animals_yesterday' => $animalsYesterday,
                'animals_active' => $herd->filter(fn ($a) => $name === null || $a->species === $name)->count(),
                'per_animal_yesterday' => $headsYesterday > 0 ? round($yesterdayTotal / $headsYesterday, 2) : null,
            ];
        }, $groups);
    }

    private function slotRules(): array
    {
        return [
            'measured_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.CarbonImmutable::now('Africa/Nairobi')->toDateString()],
            'session' => ['required', Rule::in(self::SESSIONS)],
            'kind' => ['required', Rule::in(array_keys(self::KINDS))],
        ];
    }

    private function slot(Farm $farm, array $slot): Collection
    {
        return DB::table('livestock_measurements')->where('farm_id', $farm->id)->where('measured_on', $slot['measured_on'])
            ->where('session', $slot['session'])->where('kind', $slot['kind'])->get(['id', 'livestock_record_id', 'value']);
    }
}
