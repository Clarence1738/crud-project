<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FarmCollaborationTest extends TestCase
{
    use RefreshDatabase;

    private function farmWithField(User $owner, string $name = 'Green Valley Farm'): array
    {
        $farm = $this->actingAs($owner)->postJson('/api/farms', ['name' => $name, 'county' => 'Nakuru', 'size_hectares' => 20])
            ->assertCreated()->assertJsonPath('data.role', 'Owner')->json('data.id');
        $field = $this->postJson("/api/farms/{$farm}/operations/fields", ['name' => 'North Field', 'size_hectares' => 6, 'status' => 'In use'])
            ->assertCreated()->json('data.id');

        return [$farm, $field];
    }

    private function crop(string $farm, string $field, array $overrides = []): string
    {
        return $this->postJson("/api/farms/{$farm}/crops", [
            'crop' => 'Maize', 'variety' => 'H614D', 'field_id' => $field, 'area_hectares' => 4, 'status' => 'Active', ...$overrides,
        ])->assertCreated()->json('data.id');
    }

    private function join(User $owner, string $farm, User $invitee, string $role): void
    {
        $code = $this->actingAs($owner)->postJson("/api/farms/{$farm}/invitations", ['email' => strtoupper($invitee->email), 'role' => $role])
            ->assertCreated()->json('data.code');
        $this->actingAs($invitee)->postJson('/api/farm-invitations/accept', ['code' => $code])
            ->assertOk()->assertJsonPath('data.id', $farm)->assertJsonPath('data.role', $role);
    }

    public function test_crop_seasons_can_be_edited_archived_and_restored(): void
    {
        $owner = User::factory()->create();
        [$farm, $field] = $this->farmWithField($owner);
        $crop = $this->crop($farm, $field);

        $this->putJson("/api/farms/{$farm}/crops/{$crop}", [
            'crop' => 'Beans', 'variety' => 'Rosecoco', 'field_id' => $field, 'area_hectares' => 3,
            'status' => 'Harvesting', 'harvested_kg' => 800,
        ])->assertOk()->assertJsonPath('data.crop', 'Beans')->assertJsonPath('data.harvested_kg', '800.00');
        $this->putJson("/api/farms/{$farm}/crops/{$crop}", [
            'crop' => 'Beans', 'field_id' => $field, 'area_hectares' => 9, 'status' => 'Active',
        ])->assertStatus(422);

        $this->patchJson("/api/farms/{$farm}/crops/{$crop}/archive", ['archived' => true])->assertOk();
        $this->getJson("/api/farms/{$farm}/crops")->assertJsonCount(0, 'data');
        $this->getJson("/api/farms/{$farm}/crops?archived=1")->assertJsonCount(1, 'data');
        $this->getJson("/api/farms/{$farm}/overview")->assertJsonPath('data.crops', 0)->assertJsonPath('data.land.used_hectares', 0);
        $this->putJson("/api/farms/{$farm}/crops/{$crop}", [
            'crop' => 'Beans', 'field_id' => $field, 'area_hectares' => 3, 'status' => 'Active',
        ])->assertStatus(409);

        $this->patchJson("/api/farms/{$farm}/crops/{$crop}/archive", ['archived' => false])->assertOk();
        $this->getJson("/api/farms/{$farm}/overview")->assertJsonPath('data.active_crops', 1);
    }

    public function test_livestock_can_be_edited_archived_and_keeps_unique_tags(): void
    {
        $owner = User::factory()->create();
        [$farm] = $this->farmWithField($owner);
        $cow = $this->postJson("/api/farms/{$farm}/livestock", [
            'tracking_type' => 'Individual', 'tag_number' => 'KE-001', 'species' => 'Dairy cattle', 'quantity' => 1, 'status' => 'Active',
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/farms/{$farm}/livestock", [
            'tracking_type' => 'Individual', 'tag_number' => 'KE-001', 'species' => 'Goats', 'quantity' => 1, 'status' => 'Active',
        ])->assertUnprocessable()->assertJsonValidationErrors('tag_number');

        $this->putJson("/api/farms/{$farm}/livestock/{$cow}", [
            'tracking_type' => 'Individual', 'tag_number' => 'KE-001', 'species' => 'Dairy cattle', 'breed' => 'Ayrshire', 'quantity' => 1, 'status' => 'Sold',
        ])->assertOk()->assertJsonPath('data.breed', 'Ayrshire')->assertJsonPath('data.status', 'Sold');
        $this->patchJson("/api/farms/{$farm}/livestock/{$cow}/archive", ['archived' => true])->assertOk();
        $this->getJson("/api/farms/{$farm}/livestock")->assertJsonCount(0, 'data');
        $this->getJson("/api/farms/{$farm}/livestock?archived=1")->assertJsonCount(1, 'data');
    }

    public function test_activities_and_health_events_are_limited_to_open_records_on_the_same_farm(): void
    {
        $owner = User::factory()->create();
        [$farm, $field] = $this->farmWithField($owner);
        [$otherFarm, $otherField] = $this->farmWithField($owner, 'Sunrise Farm');
        $crop = $this->crop($farm, $field);
        $foreignCrop = $this->crop($otherFarm, $otherField);
        $closedCrop = $this->crop($farm, $field, ['status' => 'Completed']);
        $cow = $this->postJson("/api/farms/{$farm}/livestock", [
            'tracking_type' => 'Individual', 'tag_number' => 'KE-010', 'species' => 'Dairy cattle', 'quantity' => 1, 'status' => 'Active',
        ])->json('data.id');

        $this->postJson("/api/farms/{$farm}/operations/activities", [
            'crop_season_id' => $crop, 'type' => 'Planting', 'activity_date' => '2026-11-20',
        ])->assertCreated()->assertJsonPath('data.crop_label', 'Maize H614D · North Field')->assertJsonPath('data.cost_kes', fn ($cost) => (float) $cost === 0.0);
        foreach ([$foreignCrop, $closedCrop] as $invalid) {
            $this->postJson("/api/farms/{$farm}/operations/activities", [
                'crop_season_id' => $invalid, 'type' => 'Planting', 'activity_date' => '2026-11-20',
            ])->assertUnprocessable()->assertJsonValidationErrors('crop_season_id');
        }

        $this->postJson("/api/farms/{$farm}/operations/health", [
            'livestock_record_id' => $cow, 'type' => 'Vaccination', 'event_date' => '2026-11-20',
            'next_due_date' => '2027-05-20', 'medicine' => 'FMD vaccine', 'cost_kes' => 450,
        ])->assertCreated()->assertJsonPath('data.animal_label', 'KE-010 · Dairy cattle');
        $this->postJson("/api/farms/{$farm}/operations/health", [
            'livestock_record_id' => $cow, 'type' => 'Treatment', 'event_date' => '2026-11-20', 'next_due_date' => '2026-11-01',
        ])->assertUnprocessable()->assertJsonValidationErrors('next_due_date');
        $this->patchJson("/api/farms/{$farm}/livestock/{$cow}/archive", ['archived' => true]);
        $this->postJson("/api/farms/{$farm}/operations/health", [
            'livestock_record_id' => $cow, 'type' => 'Treatment', 'event_date' => '2026-11-21',
        ])->assertUnprocessable()->assertJsonValidationErrors('livestock_record_id');
        $this->getJson("/api/farms/{$farm}/operations/activities")->assertJsonCount(1, 'data');
        $this->getJson("/api/farms/{$farm}/operations/health")->assertJsonCount(1, 'data');
    }

    public function test_invitations_require_the_invited_email_and_are_single_use(): void
    {
        $owner = User::factory()->create();
        $invitee = User::factory()->create();
        $stranger = User::factory()->create();
        [$farm] = $this->farmWithField($owner);

        $code = $this->actingAs($owner)->postJson("/api/farms/{$farm}/invitations", ['email' => $invitee->email, 'role' => 'Manager'])
            ->assertCreated()->json('data.code');
        $this->getJson("/api/farms/{$farm}/invitations")->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.code');
        $this->postJson("/api/farms/{$farm}/invitations", ['email' => $owner->email, 'role' => 'Worker'])->assertStatus(422);
        $this->postJson("/api/farms/{$farm}/invitations", ['email' => 'x@example.com', 'role' => 'Owner'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');

        $this->actingAs($stranger)->postJson('/api/farm-invitations/accept', ['code' => $code])->assertStatus(422);
        $this->getJson("/api/farms/{$farm}/members")->assertNotFound();
        $this->actingAs($invitee)->postJson('/api/farm-invitations/accept', ['code' => $code])->assertOk()->assertJsonPath('data.role', 'Manager');
        $this->postJson('/api/farm-invitations/accept', ['code' => $code])->assertStatus(422);
        $this->getJson('/api/farms')->assertJsonCount(1, 'data')->assertJsonPath('data.0.role', 'Manager');
        $this->getJson("/api/farms/{$farm}/members")->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.role', 'Owner');

        $revocable = $this->actingAs($owner)->postJson("/api/farms/{$farm}/invitations", ['email' => $stranger->email, 'role' => 'Worker'])->json('data');
        $this->deleteJson("/api/farms/{$farm}/invitations/{$revocable['id']}")->assertNoContent();
        $this->actingAs($stranger)->postJson('/api/farm-invitations/accept', ['code' => $revocable['code']])->assertStatus(422);
    }

    public function test_roles_limit_what_managers_and_workers_can_change(): void
    {
        $owner = User::factory()->create();
        $manager = User::factory()->create();
        $worker = User::factory()->create();
        [$farm, $field] = $this->farmWithField($owner);
        $crop = $this->crop($farm, $field);
        $this->join($owner, $farm, $manager, 'Manager');
        $this->join($owner, $farm, $worker, 'Worker');

        $this->actingAs($manager)->postJson("/api/farms/{$farm}/crops", ['crop' => 'Beans', 'field_id' => $field, 'area_hectares' => 1, 'status' => 'Planned'])->assertCreated();
        $this->putJson("/api/farms/{$farm}", ['name' => 'Renamed', 'county' => 'Nakuru'])->assertForbidden();
        $this->getJson("/api/farms/{$farm}/operations/finance")->assertForbidden();
        $this->postJson("/api/farms/{$farm}/invitations", ['email' => 'new@example.com', 'role' => 'Worker'])->assertForbidden();
        $mine = $this->postJson("/api/farms/{$farm}/operations/tasks", ['title' => 'Spray north field', 'priority' => 'High', 'status' => 'Open', 'assignee_id' => $worker->id])
            ->assertCreated()->assertJsonPath('data.assignee_name', $worker->name)->json('data.id');
        $theirs = $this->postJson("/api/farms/{$farm}/operations/tasks", ['title' => 'Service pump', 'priority' => 'Low', 'status' => 'Open', 'assignee_id' => $manager->id])->json('data.id');
        $this->postJson("/api/farms/{$farm}/operations/tasks", ['title' => 'Outsider', 'priority' => 'Low', 'status' => 'Open', 'assignee_id' => User::factory()->create()->id])
            ->assertUnprocessable()->assertJsonValidationErrors('assignee_id');

        $this->actingAs($worker)->getJson("/api/farms/{$farm}/overview")->assertOk();
        $this->getJson("/api/farms/{$farm}/crops")->assertOk()->assertJsonCount(2, 'data');
        $this->postJson("/api/farms/{$farm}/crops", ['crop' => 'Beans', 'field_id' => $field, 'area_hectares' => 1, 'status' => 'Planned'])->assertForbidden();
        $this->patchJson("/api/farms/{$farm}/crops/{$crop}/archive", ['archived' => true])->assertForbidden();
        $this->postJson("/api/farms/{$farm}/operations/inventory", ['name' => 'DAP', 'category' => 'Fertilizer', 'unit' => 'kg', 'quantity' => 50, 'reorder_level' => 10])->assertForbidden();
        $this->getJson("/api/farms/{$farm}/operations/finance")->assertForbidden();
        $this->postJson("/api/farms/{$farm}/operations/activities", ['crop_season_id' => $crop, 'type' => 'Weeding', 'activity_date' => '2026-11-22'])->assertCreated();
        $this->putJson("/api/farms/{$farm}/operations/tasks/{$mine}", ['title' => 'Changed', 'priority' => 'Low', 'status' => 'Completed'])->assertForbidden();
        $this->patchJson("/api/farms/{$farm}/tasks/{$mine}/status", ['status' => 'Completed'])->assertOk()->assertJsonPath('data.status', 'Completed');
        $this->patchJson("/api/farms/{$farm}/tasks/{$theirs}/status", ['status' => 'Completed'])->assertForbidden();
        $this->getJson("/api/farms/{$farm}/invitations")->assertForbidden();

        $this->actingAs($owner)->patchJson("/api/farms/{$farm}/members/{$worker->id}", ['role' => 'Manager'])->assertOk();
        $this->patchJson("/api/farms/{$farm}/members/{$owner->id}", ['role' => 'Worker'])->assertStatus(422);
        $this->deleteJson("/api/farms/{$farm}/members/{$owner->id}")->assertStatus(422);
        $this->deleteJson("/api/farms/{$farm}/members/{$worker->id}")->assertNoContent();
        $tasks = collect($this->getJson("/api/farms/{$farm}/operations/tasks")->json('data'))->keyBy('id');
        $this->assertNull($tasks[$mine]['assignee_id']);
        $this->assertSame($manager->id, $tasks[$theirs]['assignee_id']);
        $this->actingAs($worker)->getJson("/api/farms/{$farm}/overview")->assertNotFound();

        $this->actingAs($manager)->deleteJson("/api/farms/{$farm}/members/{$manager->id}")->assertNoContent();
        $this->getJson('/api/farms')->assertJsonCount(0, 'data');
    }
}
