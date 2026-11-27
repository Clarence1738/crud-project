<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * System Administrator functions (FS section 3): review accounts and suspend or reactivate them.
 * Administrators manage accounts only; they get no access to farm records or finance.
 */
class AdminController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        $this->ensureAdmin($request);
        $farms = DB::table('farm_memberships')->select('user_id', DB::raw('count(*) as farms'))->groupBy('user_id')->pluck('farms', 'user_id');
        $users = User::query()->orderBy('name')->get()->map(fn (User $user) => $this->present($user, (int) ($farms[$user->id] ?? 0)));

        return response()->json(['data' => $users]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $this->ensureAdmin($request);
        $data = $request->validate(['status' => ['required', Rule::in(['Active', 'Suspended'])]]);
        abort_if($user->id === $request->user()->id, 422, 'You cannot suspend your own account.');
        abort_if($user->is_admin && $data['status'] === 'Suspended', 422, 'Administrator accounts cannot be suspended here.');
        $user->forceFill(['suspended_at' => $data['status'] === 'Suspended' ? now() : null])->save();
        if ($data['status'] === 'Suspended') {
            // Signs the account out everywhere when sessions are stored in the database.
            DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        return response()->json(['data' => $this->present($user->fresh(), DB::table('farm_memberships')->where('user_id', $user->id)->count())]);
    }

    private function ensureAdmin(Request $request): void
    {
        abort_unless($request->user()->is_admin, 403, 'Only System Administrators can manage accounts.');
    }

    private function present(User $user, int $farms): array
    {
        return [
            'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
            'role' => $user->is_admin ? 'System Administrator' : 'User',
            'status' => $user->suspended_at ? 'Suspended' : 'Active',
            'farms' => $farms, 'last_login_at' => $user->last_login_at?->toIso8601String(), 'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
