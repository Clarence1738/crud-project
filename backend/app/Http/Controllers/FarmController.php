<?php

namespace App\Http\Controllers;

use App\Models\CropSeason;
use App\Models\Farm;
use App\Models\LivestockRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class FarmController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => Farm::whereIn('id', $this->farmIds($request))->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->farmData($request);
        $farm = DB::transaction(function () use ($request, $data): Farm {
            $farm = new Farm($data);
            $farm->owner_id = $request->user()->id;
            $farm->save();
            DB::table('farm_memberships')->insert(['farm_id' => $farm->id, 'user_id' => $request->user()->id, 'role' => 'Owner', 'created_at' => now(), 'updated_at' => now()]);
            return $farm;
        });
        return response()->json(['data' => $farm], 201);
    }

    public function update(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm, 'Owner');
        $farm->update($this->farmData($request));

        return response()->json(['data' => $farm->fresh()]);
    }

    public function overview(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm);
        $activeCrops = CropSeason::where('farm_id', $farm->id)
            ->whereIn('status', ['Planned', 'Active', 'Harvesting']);
        $usedHectares = (float) (clone $activeCrops)->sum('area_hectares');
        $farmHectares = (float) ($farm->size_hectares ?? 0);

        return response()->json(['data' => [
            'crops' => CropSeason::where('farm_id', $farm->id)->count(),
            'active_crops' => (clone $activeCrops)->count(),
            'livestock' => LivestockRecord::where('farm_id', $farm->id)->where('status', 'Active')->sum('quantity'),
            'crop_breakdown' => CropSeason::where('farm_id', $farm->id)->selectRaw('crop, COUNT(*) AS count')->groupBy('crop')->orderBy('crop')->get(),
            'land' => [
                'total_hectares' => $farmHectares,
                'used_hectares' => $usedHectares,
                'remaining_hectares' => max(0, $farmHectares - $usedHectares),
                'used_percentage' => $farmHectares > 0 ? min(100, round(($usedHectares / $farmHectares) * 100, 1)) : null,
                'overallocated_hectares' => max(0, $usedHectares - $farmHectares),
                'by_crop' => (clone $activeCrops)->selectRaw('crop, SUM(area_hectares) AS hectares')
                    ->groupBy('crop')->orderBy('crop')->get(),
            ],
            'livestock_breakdown' => LivestockRecord::where('farm_id', $farm->id)->where('status', 'Active')->selectRaw('species, SUM(quantity) AS count')->groupBy('species')->orderBy('species')->get(),
        ]]);
    }

    public function crops(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm);
        return response()->json(CropSeason::where('farm_id', $farm->id)->latest()->paginate(50));
    }

    public function storeCrop(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm);
        $data = $request->validate(['crop' => ['required', Rule::in(['Maize','Beans','Potatoes','Tomatoes'])], 'variety' => ['nullable','string','max:80'], 'field_id' => ['required','uuid'], 'area_hectares' => ['required','numeric','gt:0'], 'planted_on' => ['nullable','date_format:Y-m-d'], 'expected_harvest_date' => ['nullable','date_format:Y-m-d','after_or_equal:planted_on'], 'status' => ['required', Rule::in(['Planned','Active','Harvesting','Completed','Cancelled'])], 'expected_yield_kg' => ['nullable','numeric','min:0'], 'harvested_kg' => ['nullable','numeric','min:0'], 'notes' => ['nullable','string','max:2000']]);
        $field = DB::table('farm_fields')->where('id', $data['field_id'])->where('farm_id', $farm->id)->first();
        abort_unless($field, 422, 'The selected field does not belong to this farm.');
        abort_if((float) $data['area_hectares'] > (float) $field->size_hectares, 422, 'The crop area cannot exceed the selected field size.');
        $data['field_name'] = $field->name;
        $crop = new CropSeason($data); $crop->farm_id = $farm->id; $crop->save();
        return response()->json(['data' => $crop], 201);
    }

    public function livestock(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm);
        return response()->json(LivestockRecord::where('farm_id', $farm->id)->latest()->paginate(50));
    }

    public function storeLivestock(Request $request, Farm $farm): JsonResponse
    {
        $this->authorizeFarm($request, $farm);
        $data = $request->validate(['tracking_type' => ['required', Rule::in(['Individual','Group'])], 'tag_number' => ['nullable','required_if:tracking_type,Individual','string','max:60'], 'group_name' => ['nullable','required_if:tracking_type,Group','string','max:100'], 'species' => ['required', Rule::in(['Dairy cattle','Goats','Sheep','Poultry'])], 'breed' => ['nullable','string','max:80'], 'sex' => ['nullable', Rule::in(['Female','Male','Mixed'])], 'quantity' => ['required','integer','min:1'], 'birth_date' => ['nullable','date_format:Y-m-d','before_or_equal:today'], 'status' => ['required', Rule::in(['Active','Sold','Transferred','Deceased','Culled'])], 'location' => ['nullable','string','max:120'], 'notes' => ['nullable','string','max:2000']]);
        if ($data['tracking_type'] === 'Individual') $data['quantity'] = 1;
        $record = new LivestockRecord($data); $record->farm_id = $farm->id; $record->save();
        return response()->json(['data' => $record], 201);
    }

    private function farmIds(Request $request)
    {
        return DB::table('farm_memberships')->select('farm_id')->where('user_id', $request->user()->id);
    }

    private function authorizeFarm(Request $request, Farm $farm, ?string $role = null): void
    {
        $membership = DB::table('farm_memberships')->where('farm_id', $farm->id)
            ->where('user_id', $request->user()->id);
        if ($role !== null) {
            $membership->where('role', $role);
        }
        abort_unless($membership->exists(), 404);
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
