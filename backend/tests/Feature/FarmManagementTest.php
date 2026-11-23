<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FarmManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_manage_multiple_farms_with_private_crop_and_livestock_records(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $first = $this->actingAs($owner)->postJson('/api/farms', [
            'name' => 'Green Valley Farm', 'county' => 'Nakuru', 'size_hectares' => 18.5,
        ])->assertCreated()->json('data.id');
        $second = $this->postJson('/api/farms', [
            'name' => 'Sunrise Farm', 'county' => 'Kiambu', 'size_hectares' => 8,
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/farms')->assertOk()->assertJsonCount(2, 'data');
        $this->putJson("/api/farms/{$first}", [
            'name' => 'Green Valley Estate', 'county' => 'Nakuru',
            'location' => 'Njoro', 'size_hectares' => 20,
        ])->assertOk()->assertJsonPath('data.name', 'Green Valley Estate')
            ->assertJsonPath('data.size_hectares', '20.00');
        $field = $this->postJson("/api/farms/{$first}/operations/fields", [
            'name' => 'North Field', 'size_hectares' => 6,
            'soil_type' => 'Loam', 'status' => 'In use',
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/farms/{$first}/crops", [
            'crop' => 'Maize', 'variety' => 'H614D', 'field_id' => $field,
            'area_hectares' => 4.5, 'status' => 'Active', 'expected_yield_kg' => 9000,
        ])->assertCreated()->assertJsonPath('data.crop', 'Maize')
            ->assertJsonPath('data.field_name', 'North Field');
        $this->postJson("/api/farms/{$first}/livestock", [
            'tracking_type' => 'Individual', 'tag_number' => 'KE-001',
            'species' => 'Dairy cattle', 'breed' => 'Friesian', 'sex' => 'Female',
            'quantity' => 3, 'status' => 'Active',
        ])->assertCreated()->assertJsonPath('data.quantity', 1);
        $this->postJson("/api/farms/{$second}/livestock", [
            'tracking_type' => 'Group', 'group_name' => 'Layers A',
            'species' => 'Poultry', 'sex' => 'Mixed', 'quantity' => 120, 'status' => 'Active',
        ])->assertCreated()->assertJsonPath('data.quantity', 120);

        $this->getJson("/api/farms/{$first}/overview")
            ->assertOk()->assertJsonPath('data.active_crops', 1)
            ->assertJsonPath('data.livestock', 1)
            ->assertJsonPath('data.land.total_hectares', 20)
            ->assertJsonPath('data.land.used_hectares', 4.5)
            ->assertJsonPath('data.land.remaining_hectares', 15.5)
            ->assertJsonPath('data.land.used_percentage', 22.5)
            ->assertJsonPath('data.land.by_crop.0.crop', 'Maize');
        $this->actingAs($other)->getJson("/api/farms/{$first}/overview")->assertNotFound();
        $this->getJson("/api/farms/{$first}/crops")->assertNotFound();
        $this->getJson("/api/farms/{$first}/livestock")->assertNotFound();
    }

    public function test_farm_inputs_are_validated(): void
    {
        $owner = User::factory()->create();
        $farm = $this->actingAs($owner)->postJson('/api/farms', [
            'name' => 'Demo Farm', 'county' => 'Nakuru',
        ])->json('data.id');

        $this->postJson("/api/farms/{$farm}/crops", [
            'crop' => 'Unknown', 'field_name' => 'A', 'area_hectares' => -1, 'status' => 'Active',
        ])->assertUnprocessable()->assertJsonValidationErrors(['crop', 'area_hectares']);
        $this->postJson("/api/farms/{$farm}/livestock", [
            'tracking_type' => 'Individual', 'species' => 'Dairy cattle',
            'quantity' => 1, 'status' => 'Active',
        ])->assertUnprocessable()->assertJsonValidationErrors('tag_number');
    }
}
