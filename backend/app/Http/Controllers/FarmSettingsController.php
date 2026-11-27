<?php

namespace App\Http\Controllers;

use App\Farms\AuditLog;
use App\Farms\FarmAccess;
use App\Models\Farm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Per farm options. Every member can read them; only the owner can change them. */
class FarmSettingsController extends Controller
{
    public const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    public function __construct(private readonly FarmAccess $access, private readonly AuditLog $audit) {}

    public function show(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);

        return response()->json(['data' => $this->settings($farm)]);
    }

    public function update(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-farm');
        $data = $request->validate([
            'reminder_days' => ['required', 'integer', 'min:1', 'max:60'],
            'manager_finance_access' => ['required', 'boolean'],
            'season_start_month' => ['required', Rule::in(self::MONTHS)],
        ]);
        DB::table('farm_settings')->updateOrInsert(['farm_id' => $farm->id], [...$data, 'updated_at' => now(), 'created_at' => now()]);
        $this->audit->record($request, $farm, 'Updated', 'Settings',
            "Reminders {$data['reminder_days']} days; manager finance access ".($data['manager_finance_access'] ? 'on' : 'off'));

        return response()->json(['data' => $this->settings($farm)]);
    }

    private function settings(Farm $farm): array
    {
        $row = DB::table('farm_settings')->where('farm_id', $farm->id)->first();

        return [
            'reminder_days' => (int) ($row->reminder_days ?? 7),
            'manager_finance_access' => (bool) ($row->manager_finance_access ?? false),
            'season_start_month' => $row->season_start_month ?? 'March',
            'currency' => 'KES',
            'timezone' => 'Africa/Nairobi',
        ];
    }
}
