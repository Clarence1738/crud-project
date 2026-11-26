<?php

namespace App\Http\Controllers;

use App\Farms\FarmAccess;
use App\Models\CropSeason;
use App\Models\Farm;
use App\Models\LivestockRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FarmController extends Controller
{
    public function __construct(private readonly FarmAccess $access) {}

    public function index(Request $request): JsonResponse
    {
        $farms = Farm::query()
            ->join('farm_memberships', 'farm_memberships.farm_id', '=', 'farms.id')
            ->where('farm_memberships.user_id', $request->user()->id)
            ->orderBy('farms.name')
            ->get(['farms.*', 'farm_memberships.role']);

        return response()->json(['data' => $farms]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->farmData($request);
        $farm = DB::transaction(function () use ($request, $data): Farm {
            $farm = new Farm($data);
            $farm->owner_id = $request->user()->id;
            $farm->save();
            DB::table('farm_memberships')->insert(['farm_id' => $farm->id, 'user_id' => $request->user()->id, 'role' => FarmAccess::OWNER, 'created_at' => now(), 'updated_at' => now()]);

            return $farm;
        });
        $farm->setAttribute('role', FarmAccess::OWNER);

        return response()->json(['data' => $farm], 201);
    }

    public function update(Request $request, Farm $farm): JsonResponse
    {
        $role = $this->access->authorize($request, $farm, 'manage-farm');
        $farm->update($this->farmData($request));

        return response()->json(['data' => $farm->fresh()->setAttribute('role', $role)]);
    }

    public function overview(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);
        $crops = CropSeason::where('farm_id', $farm->id)->whereNull('archived_at');
        $livestock = LivestockRecord::where('farm_id', $farm->id)->whereNull('archived_at')->where('status', 'Active');
        $activeCrops = (clone $crops)->whereIn('status', ['Planned', 'Active', 'Harvesting']);
        $usedHectares = (float) (clone $activeCrops)->sum('area_hectares');
        $farmHectares = (float) ($farm->size_hectares ?? 0);

        return response()->json(['data' => [
            'crops' => (clone $crops)->count(),
            'active_crops' => (clone $activeCrops)->count(),
            'livestock' => (clone $livestock)->sum('quantity'),
            'crop_breakdown' => (clone $crops)->selectRaw('crop, COUNT(*) AS count')->groupBy('crop')->orderBy('crop')->get(),
            'land' => [
                'total_hectares' => $farmHectares,
                'used_hectares' => $usedHectares,
                'remaining_hectares' => max(0, $farmHectares - $usedHectares),
                'used_percentage' => $farmHectares > 0 ? min(100, round(($usedHectares / $farmHectares) * 100, 1)) : null,
                'overallocated_hectares' => max(0, $usedHectares - $farmHectares),
                'by_crop' => (clone $activeCrops)->selectRaw('crop, SUM(area_hectares) AS hectares')
                    ->groupBy('crop')->orderBy('crop')->get(),
            ],
            'livestock_breakdown' => (clone $livestock)->selectRaw('species, SUM(quantity) AS count')->groupBy('species')->orderBy('species')->get(),
        ]]);
    }

    public function crops(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);

        return response()->json($this->archiveScope($request, CropSeason::where('farm_id', $farm->id))->latest()->paginate(50));
    }

    public function storeCrop(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $data = $this->cropData($request, $farm);
        $crop = new CropSeason($data);
        $crop->farm_id = $farm->id;
        $crop->save();

        return response()->json(['data' => $crop], 201);
    }

    public function updateCrop(Request $request, Farm $farm, CropSeason $crop): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $this->belongsTo($crop, $farm);
        abort_if($crop->archived_at !== null, 409, 'Restore this crop season before editing it.');
        $crop->update($this->cropData($request, $farm));

        return response()->json(['data' => $crop->fresh()]);
    }

    public function archiveCrop(Request $request, Farm $farm, CropSeason $crop): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $this->belongsTo($crop, $farm);
        $crop->archived_at = $this->archiveFlag($request) ? now() : null;
        $crop->save();

        return response()->json(['data' => $crop->fresh()]);
    }

    public function livestock(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);

        return response()->json($this->archiveScope($request, LivestockRecord::where('farm_id', $farm->id))->latest()->paginate(50));
    }

    public function storeLivestock(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $record = new LivestockRecord($this->livestockData($request, $farm));
        $record->farm_id = $farm->id;
        $record->save();

        return response()->json(['data' => $record], 201);
    }

    public function updateLivestock(Request $request, Farm $farm, LivestockRecord $livestock): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $this->belongsTo($livestock, $farm);
        abort_if($livestock->archived_at !== null, 409, 'Restore this livestock record before editing it.');
        $livestock->update($this->livestockData($request, $farm, $livestock->id));

        return response()->json(['data' => $livestock->fresh()]);
    }

    public function archiveLivestock(Request $request, Farm $farm, LivestockRecord $livestock): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-records');
        $this->belongsTo($livestock, $farm);
        $livestock->archived_at = $this->archiveFlag($request) ? now() : null;
        $livestock->save();

        return response()->json(['data' => $livestock->fresh()]);
    }

    private function cropData(Request $request, Farm $farm): array
    {
        $data = $request->validate(['crop' => ['required', Rule::in(['Maize', 'Beans', 'Potatoes', 'Tomatoes'])], 'variety' => ['nullable', 'string', 'max:80'], 'field_id' => ['required', 'uuid'], 'area_hectares' => ['required', 'numeric', 'gt:0'], 'planted_on' => ['nullable', 'date_format:Y-m-d'], 'expected_harvest_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:planted_on'], 'status' => ['required', Rule::in(['Planned', 'Active', 'Harvesting', 'Completed', 'Cancelled'])], 'expected_yield_kg' => ['nullable', 'numeric', 'min:0'], 'harvested_kg' => ['nullable', 'numeric', 'min:0'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $field = DB::table('farm_fields')->where('id', $data['field_id'])->where('farm_id', $farm->id)->first();
        abort_unless($field, 422, 'The selected field does not belong to this farm.');
        abort_if((float) $data['area_hectares'] > (float) $field->size_hectares, 422, 'The crop area cannot exceed the selected field size.');
        $data['field_name'] = $field->name;
        $data['harvested_kg'] ??= 0;

        return $data;
    }

    private function livestockData(Request $request, Farm $farm, ?string $ignoreId = null): array
    {
        $data = $request->validate(['tracking_type' => ['required', Rule::in(['Individual', 'Group'])], 'tag_number' => ['nullable', 'required_if:tracking_type,Individual', 'string', 'max:60', Rule::unique('livestock_records', 'tag_number')->where('farm_id', $farm->id)->ignore($ignoreId)], 'group_name' => ['nullable', 'required_if:tracking_type,Group', 'string', 'max:100'], 'species' => ['required', Rule::in(['Dairy cattle', 'Goats', 'Sheep', 'Poultry'])], 'breed' => ['nullable', 'string', 'max:80'], 'sex' => ['nullable', Rule::in(['Female', 'Male', 'Mixed'])], 'quantity' => ['required', 'integer', 'min:1'], 'birth_date' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:today'], 'status' => ['required', Rule::in(['Active', 'Sold', 'Transferred', 'Deceased', 'Culled'])], 'location' => ['nullable', 'string', 'max:120'], 'notes' => ['nullable', 'string', 'max:2000']]);
        if ($data['tracking_type'] === 'Individual') {
            $data['quantity'] = 1;
            $data['group_name'] = null;
        } else {
            $data['tag_number'] = null;
        }

        return $data;
    }

    private function archiveScope(Request $request, $query)
    {
        return $request->boolean('archived') ? $query->whereNotNull('archived_at') : $query->whereNull('archived_at');
    }

    private function archiveFlag(Request $request): bool
    {
        return (bool) $request->validate(['archived' => ['required', 'boolean']])['archived'];
    }

    private function belongsTo($record, Farm $farm): void
    {
        abort_unless($record->farm_id === $farm->id, 404);
    }

    private function farmData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'county' => ['required', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:160'],
            'size_hectares' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }
}
