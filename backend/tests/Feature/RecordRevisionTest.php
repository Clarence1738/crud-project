<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RecordRevisionTest extends TestCase
{
    use RefreshDatabase;

    public function test_revisions_follow_committed_changes_and_are_account_scoped(): void
    {
        $this->getJson('/api/record-revisions')->assertUnauthorized();
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $id = (string) Str::uuid();

        $this->actingAs($owner)->getJson('/api/record-revisions')
            ->assertOk()->assertJsonPath('documents', '0');

        DB::transaction(function () use ($owner, $id): void {
            DB::table('documents')->insert([
                'id' => $id, 'user_id' => $owner->id, 'title' => 'Receipt',
                'path' => 'receipt.txt', 'original_name' => 'receipt.txt',
                'mime_type' => 'text/plain', 'size' => 1,
            ]);
        });
        $this->getJson('/api/record-revisions')->assertJsonPath('documents', '1');

        DB::beginTransaction();
        DB::table('documents')->where('id', $id)->update(['title' => 'Discarded']);
        DB::rollBack();
        $this->getJson('/api/record-revisions')->assertJsonPath('documents', '1');

        DB::table('documents')->where('id', $id)->update(['title' => 'Updated']);
        DB::table('documents')->where('id', $id)->delete();
        $this->getJson('/api/record-revisions')
            ->assertJsonPath('documents', '3')->assertJsonPath('transports', '0');
        $this->actingAs($other)->getJson('/api/record-revisions')->assertJsonPath('documents', '0');
    }
}
