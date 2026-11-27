<?php

namespace App\Farms;

use App\Models\Farm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Records who changed what on a farm, and when (URS-A03). Only the farm owner can read it. */
class AuditLog
{
    public function record(Request $request, Farm|string $farm, string $action, string $recordType, string $summary): void
    {
        DB::table('audit_events')->insert([
            'id' => (string) Str::uuid(),
            'farm_id' => $farm instanceof Farm ? $farm->id : $farm,
            'actor_id' => $request->user()?->id,
            'action' => $action,
            'record_type' => $recordType,
            'summary' => Str::limit($summary, 250, '…'),
            'occurred_at' => now(),
        ]);
    }
}
