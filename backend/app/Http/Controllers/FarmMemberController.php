<?php

namespace App\Http\Controllers;

use App\Farms\FarmAccess;
use App\Models\Farm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Farm collaboration: members, roles, and invitation codes.
 *
 * Invitations do not send e-mail. The Owner receives a one-time code, shares
 * it with the invitee, and the invitee accepts it while signed in with the
 * invited e-mail address. Only a SHA-256 hash of the code is stored.
 */
class FarmMemberController extends Controller
{
    private const INVITATION_DAYS = 7;

    public function __construct(private readonly FarmAccess $access) {}

    public function index(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm);
        $members = DB::table('farm_memberships')
            ->join('users', 'users.id', '=', 'farm_memberships.user_id')
            ->where('farm_memberships.farm_id', $farm->id)
            ->orderByRaw("CASE farm_memberships.role WHEN 'Owner' THEN 0 WHEN 'Manager' THEN 1 ELSE 2 END")
            ->orderBy('users.name')
            ->get(['users.id', 'users.name', 'users.email', 'farm_memberships.role', 'farm_memberships.created_at as joined_at']);

        return response()->json(['data' => $members]);
    }

    public function updateRole(Request $request, Farm $farm, int $user): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-farm');
        $data = $request->validate(['role' => ['required', Rule::in(FarmAccess::INVITABLE_ROLES)]]);
        $membership = $this->membership($farm, $user);
        abort_if($membership->role === FarmAccess::OWNER, 422, 'The farm owner role cannot be changed.');
        DB::table('farm_memberships')->where('id', $membership->id)->update(['role' => $data['role'], 'updated_at' => now()]);

        return response()->json(['data' => ['id' => $user, 'role' => $data['role']]]);
    }

    /** Owners remove members; any non-owner member may leave. */
    public function destroy(Request $request, Farm $farm, int $user): Response
    {
        $self = $user === $request->user()->id;
        $this->access->authorize($request, $farm, $self ? 'view' : 'manage-farm');
        $membership = $this->membership($farm, $user);
        abort_if($membership->role === FarmAccess::OWNER, 422, 'The farm owner cannot be removed.');
        DB::transaction(function () use ($farm, $user, $membership): void {
            DB::table('farm_tasks')->where('farm_id', $farm->id)->where('assignee_id', $user)
                ->update(['assignee_id' => null, 'updated_at' => now()]);
            DB::table('farm_memberships')->where('id', $membership->id)->delete();
        });

        return response()->noContent();
    }

    public function invitations(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-farm');

        return response()->json(['data' => DB::table('farm_invitations')->where('farm_id', $farm->id)
            ->whereNull('accepted_at')->where('expires_at', '>', now())->orderByDesc('created_at')
            ->get(['id', 'email', 'role', 'expires_at', 'created_at'])]);
    }

    public function invite(Request $request, Farm $farm): JsonResponse
    {
        $this->access->authorize($request, $farm, 'manage-farm');
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'role' => ['required', Rule::in(FarmAccess::INVITABLE_ROLES)],
        ]);
        $email = Str::lower(trim($data['email']));
        $alreadyMember = DB::table('farm_memberships')->join('users', 'users.id', '=', 'farm_memberships.user_id')
            ->where('farm_memberships.farm_id', $farm->id)->whereRaw('LOWER(users.email) = ?', [$email])->exists();
        abort_if($alreadyMember, 422, 'This person is already a member of the farm.');

        $code = Str::random(40);
        $id = (string) Str::uuid();
        $expires = now()->addDays(self::INVITATION_DAYS);
        DB::transaction(function () use ($farm, $email, $data, $code, $id, $expires, $request): void {
            // A new invitation replaces any pending invitation for the same address.
            DB::table('farm_invitations')->where('farm_id', $farm->id)->where('email', $email)->whereNull('accepted_at')->delete();
            DB::table('farm_invitations')->insert([
                'id' => $id, 'farm_id' => $farm->id, 'email' => $email, 'role' => $data['role'],
                'token_hash' => hash('sha256', $code), 'invited_by' => $request->user()->id,
                'expires_at' => $expires, 'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        return response()->json(['data' => [
            'id' => $id, 'email' => $email, 'role' => $data['role'], 'expires_at' => $expires->toIso8601String(), 'code' => $code,
        ]], 201);
    }

    public function revoke(Request $request, Farm $farm, string $invitation): Response
    {
        $this->access->authorize($request, $farm, 'manage-farm');
        $deleted = DB::table('farm_invitations')->where('id', $invitation)->where('farm_id', $farm->id)->whereNull('accepted_at')->delete();
        abort_unless($deleted, 404);

        return response()->noContent();
    }

    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:100']]);
        $user = $request->user();
        $invitation = DB::table('farm_invitations')->where('token_hash', hash('sha256', trim($data['code'])))->first();
        $valid = $invitation && $invitation->accepted_at === null && now()->lt($invitation->expires_at)
            && Str::lower($invitation->email) === Str::lower($user->email);
        abort_unless($valid, 422, 'This invitation code is invalid, expired, or meant for another e-mail address.');

        $farm = DB::transaction(function () use ($invitation, $user): Farm {
            $claimed = DB::table('farm_invitations')->where('id', $invitation->id)->whereNull('accepted_at')
                ->update(['accepted_at' => now(), 'accepted_by' => $user->id, 'updated_at' => now()]);
            abort_unless($claimed, 422, 'This invitation has already been used.');
            $exists = DB::table('farm_memberships')->where('farm_id', $invitation->farm_id)->where('user_id', $user->id)->exists();
            if (! $exists) {
                DB::table('farm_memberships')->insert([
                    'farm_id' => $invitation->farm_id, 'user_id' => $user->id, 'role' => $invitation->role,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }

            return Farm::findOrFail($invitation->farm_id);
        });
        $farm->setAttribute('role', $this->access->role($request, $farm));

        return response()->json(['data' => $farm]);
    }

    private function membership(Farm $farm, int $user): object
    {
        $membership = DB::table('farm_memberships')->where('farm_id', $farm->id)->where('user_id', $user)->first();
        abort_unless($membership, 404);

        return $membership;
    }
}
