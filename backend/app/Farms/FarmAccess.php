<?php

namespace App\Farms;

use App\Models\Farm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Resolves the signed-in user's role on a farm and enforces role capabilities.
 *
 * Non-members receive 404 so other farms stay hidden. Members whose role lacks
 * the capability receive 403.
 */
class FarmAccess
{
    public const OWNER = 'Owner';

    public const MANAGER = 'Manager';

    public const WORKER = 'Worker';

    public const INVITABLE_ROLES = [self::MANAGER, self::WORKER];

    private const CAPABILITIES = [
        'view' => [self::OWNER, self::MANAGER, self::WORKER],
        'record-activity' => [self::OWNER, self::MANAGER, self::WORKER],
        'manage-records' => [self::OWNER, self::MANAGER],
        'finance' => [self::OWNER],
        'manage-farm' => [self::OWNER],
    ];

    public function role(Request $request, Farm $farm): ?string
    {
        return DB::table('farm_memberships')->where('farm_id', $farm->id)
            ->where('user_id', $request->user()->id)->value('role');
    }

    /** Returns the member's role after checking the capability. */
    public function authorize(Request $request, Farm $farm, string $capability = 'view'): string
    {
        $role = $this->role($request, $farm);
        abort_if($role === null, 404);
        abort_unless($this->allows($role, $capability, $farm), 403, 'Your farm role does not allow this action.');

        return $role;
    }

    /** Role capability, plus finance for Managers when the owner has enabled it in farm settings. */
    public function allows(string $role, string $capability, Farm|string $farm): bool
    {
        if (self::can($role, $capability)) {
            return true;
        }

        return $capability === 'finance' && $role === self::MANAGER && $this->managerFinanceAccess($farm);
    }

    public function managerFinanceAccess(Farm|string $farm): bool
    {
        return (bool) DB::table('farm_settings')->where('farm_id', $farm instanceof Farm ? $farm->id : $farm)->value('manager_finance_access');
    }

    public static function can(string $role, string $capability): bool
    {
        return in_array($role, self::CAPABILITIES[$capability], true);
    }

    public function farmIds(Request $request)
    {
        return DB::table('farm_memberships')->select('farm_id')->where('user_id', $request->user()->id);
    }
}
