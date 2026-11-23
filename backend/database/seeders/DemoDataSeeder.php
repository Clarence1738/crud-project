<?php

namespace Database\Seeders;

use App\Models\Document;
use App\Models\Transport;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Demo data is restricted to local and testing environments.');
        }

        DB::transaction(function (): void {
            foreach (['Clarence Wachira'] as $account => $name) {
                $user = User::firstOrCreate(
                    ['email' => 'clarencewachira6@gmail.com'],
                    ['name' => $name, 'password' => 'Vintage@1945']
                );

                $routes = [
                    ['Nairobi', 'Mombasa', 'Scheduled'],
                    ['Nakuru', 'Kisumu', 'In transit'],
                    ['Eldoret', 'Nairobi', 'Delivered'],
                    ['Thika', 'Nyeri', 'Scheduled'],
                    ['Mombasa', 'Malindi', 'In transit'],
                    ['Naivasha', 'Nakuru', 'Delivered'],
                ];

                foreach ($routes as $index => [$origin, $destination, $status]) {
                    $id = sprintf('10000000-0000-4000-8000-%012d', $account * 100 + $index + 1);
                    $record = Transport::find($id);
                    if ($record) {
                        if ($record->user_id !== $user->id) {
                            throw new RuntimeException('A demo record ID already belongs to another account.');
                        }

                        continue;
                    }
                    $record = new Transport([
                        'customer' => 'Sample Customer '.($index + 1),
                        'sender_company' => 'Sample Sender '.($index + 1),
                        'recipient_company' => 'Sample Recipient '.($index + 1),
                        'origin' => $origin,
                        'destination' => $destination,
                        'vehicle' => 'KDA '.($account + 1).($index + 1).'0A',
                        'date' => '2026-11-'.(18 + $index),
                        'expected_arrival_date' => '2026-11-'.(19 + $index),
                        'status' => $status,
                    ]);
                    $record->id = $id;
                    $record->user_id = $user->id;
                    $record->save();
                }

                foreach (['Delivery instructions', 'Transport receipt'] as $index => $title) {
                    $id = sprintf('20000000-0000-4000-8000-%012d', $account * 100 + $index + 1);
                    $document = Document::find($id);
                    if ($document) {
                        if ($document->user_id !== $user->id) {
                            throw new RuntimeException('A demo document ID already belongs to another account.');
                        }

                        continue;
                    }
                    $contents = "SAMPLE DATA ONLY\n".$title."\nPrepared for ".$name.".\n";
                    $path = $user->id.'/demo/'.$id.'.txt';
                    Storage::disk('private')->put($path, $contents);
                    $document = new Document(['title' => $title.' (sample)']);
                    $document->id = $id;
                    $document->user_id = $user->id;
                    $document->path = $path;
                    $document->original_name = 'sample-'.($index + 1).'.txt';
                    $document->mime_type = 'text/plain';
                    $document->size = strlen($contents);
                    $document->save();
                }

                $this->seedFarmData($user, $account);
            }
        });
    }

    private function seedFarmData(User $user, int $account): void
    {
        $now = now();
        $farms = $account === 0
            ? [
                ['Green Valley Farm', 'Nakuru', 'Njoro', 20, 'Mixed crop and dairy demonstration farm.'],
                ['Sunrise Farm', 'Kiambu', 'Limuru', 12, 'Highland crop and poultry farm.'],
            ]
            : [['Rift Plains Farm', 'Uasin Gishu', 'Eldoret', 28, 'Maize, beans and livestock enterprise.']];

        foreach ($farms as $farmIndex => [$name, $county, $location, $size, $notes]) {
            $number = ($account + 1) * 10 + $farmIndex + 1;
            $farmId = sprintf('30000000-0000-4000-8000-%012d', $number);
            DB::table('farms')->updateOrInsert(['id' => $farmId], [
                'owner_id' => $user->id, 'name' => $name, 'county' => $county,
                'location' => $location, 'size_hectares' => $size, 'notes' => $notes,
                'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('farm_memberships')->updateOrInsert(
                ['farm_id' => $farmId, 'user_id' => $user->id],
                ['role' => 'Owner', 'created_at' => $now, 'updated_at' => $now],
            );

            $fieldData = [
                ['North Field', 6, 'Loam', 'In use'],
                ['River Field', 4, 'Clay loam', 'In use'],
                ['Upper Field', 3, 'Sandy loam', 'Resting'],
            ];
            foreach ($fieldData as $fieldIndex => [$fieldName, $fieldSize, $soil, $status]) {
                $fieldId = sprintf('40000000-0000-4000-8000-%012d', $number * 10 + $fieldIndex + 1);
                DB::table('farm_fields')->updateOrInsert(['id' => $fieldId], [
                    'farm_id' => $farmId, 'name' => $fieldName, 'size_hectares' => $fieldSize,
                    'soil_type' => $soil, 'status' => $status, 'notes' => null,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
                if ($fieldIndex < 2) {
                    $crops = [['Maize', 'H614D', 4.5, '2026-10-10', '2027-03-15', 9000], ['Beans', 'Rosecoco', 2.5, '2026-10-18', '2027-01-28', 2400]];
                    [$crop, $variety, $area, $planted, $harvest, $yield] = $crops[$fieldIndex];
                    DB::table('crop_seasons')->updateOrInsert(
                        ['id' => sprintf('50000000-0000-4000-8000-%012d', $number * 10 + $fieldIndex + 1)],
                        ['farm_id' => $farmId, 'field_id' => $fieldId, 'crop' => $crop, 'variety' => $variety,
                         'field_name' => $fieldName, 'area_hectares' => $area, 'planted_on' => $planted,
                         'expected_harvest_date' => $harvest, 'status' => 'Active', 'expected_yield_kg' => $yield,
                         'harvested_kg' => 0, 'notes' => 'Demo crop season', 'created_at' => $now, 'updated_at' => $now],
                    );
                }
            }

            $animalId = sprintf('60000000-0000-4000-8000-%012d', $number * 10 + 1);
            DB::table('livestock_records')->updateOrInsert(['id' => $animalId], [
                'farm_id' => $farmId, 'tracking_type' => 'Individual', 'tag_number' => 'KE-'.$number.'-001',
                'group_name' => null, 'species' => 'Dairy cattle', 'breed' => 'Friesian', 'sex' => 'Female',
                'quantity' => 1, 'birth_date' => '2023-05-12', 'status' => 'Active', 'location' => 'Dairy unit',
                'notes' => 'Demo animal record', 'created_at' => $now, 'updated_at' => $now,
            ]);
            DB::table('inventory_items')->updateOrInsert(
                ['farm_id' => $farmId, 'name' => 'Dairy meal'],
                ['id' => sprintf('70000000-0000-4000-8000-%012d', $number), 'category' => 'Feed', 'unit' => 'kg',
                 'quantity' => 180, 'reorder_level' => 50, 'expires_on' => '2027-04-30', 'created_at' => $now, 'updated_at' => $now],
            );
            DB::table('farm_tasks')->updateOrInsert(
                ['id' => sprintf('80000000-0000-4000-8000-%012d', $number)],
                ['farm_id' => $farmId, 'title' => 'Inspect crop fields', 'priority' => 'High', 'due_date' => '2026-11-28',
                 'status' => 'Open', 'notes' => 'Check pests and soil moisture.', 'created_at' => $now, 'updated_at' => $now],
            );
            DB::table('farm_equipment')->updateOrInsert(
                ['id' => sprintf('90000000-0000-4000-8000-%012d', $number)],
                ['farm_id' => $farmId, 'name' => 'Knapsack sprayer', 'category' => 'Sprayer', 'status' => 'Operational',
                 'next_service_date' => '2027-01-15', 'maintenance_cost_kes' => 2500, 'created_at' => $now, 'updated_at' => $now],
            );
            DB::table('farm_transactions')->updateOrInsert(
                ['id' => sprintf('a0000000-0000-4000-8000-%012d', $number)],
                ['farm_id' => $farmId, 'type' => 'Expense', 'category' => 'Farm inputs', 'transaction_date' => '2026-11-20',
                 'amount_kes' => 18500, 'party' => 'Nakuru Agrovet', 'notes' => 'Seed and fertilizer purchase.',
                 'created_at' => $now, 'updated_at' => $now],
            );

            foreach ([
                ['Poultry flock', 'Poultry', 'Kienyeji', 'Mixed', 85, 'Poultry house'],
                ['Dairy goats', 'Goats', 'Toggenburg', 'Mixed', 12, 'Goat unit'],
            ] as $livestockIndex => [$group, $species, $breed, $sex, $quantity, $animalLocation]) {
                DB::table('livestock_records')->updateOrInsert(
                    ['id' => sprintf('61000000-0000-4000-8000-%012d', $number * 10 + $livestockIndex + 1)],
                    ['farm_id' => $farmId, 'tracking_type' => 'Group', 'tag_number' => null, 'group_name' => $group,
                     'species' => $species, 'breed' => $breed, 'sex' => $sex, 'quantity' => $quantity,
                     'birth_date' => null, 'status' => 'Active', 'location' => $animalLocation,
                     'notes' => 'Demo livestock group', 'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([
                ['Vaccination', '2026-11-05', '2027-02-05', 1800, 'Lumpy skin vaccine'],
                ['Deworming', '2026-11-12', '2027-02-12', 950, 'Albendazole'],
            ] as $eventIndex => [$type, $eventDate, $nextDue, $cost, $medicine]) {
                DB::table('livestock_events')->updateOrInsert(
                    ['id' => sprintf('c0000000-0000-4000-8000-%012d', $number * 10 + $eventIndex + 1)],
                    ['farm_id' => $farmId, 'livestock_record_id' => $animalId, 'type' => $type,
                     'event_date' => $eventDate, 'next_due_date' => $nextDue, 'cost_kes' => $cost,
                     'medicine' => $medicine, 'notes' => 'Routine herd-health event.',
                     'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([
                ['Maize seed H614D', 'Seed', 'kg', 45, 15, '2027-08-30'],
                ['NPK 17:17:17', 'Fertilizer', 'kg', 320, 100, '2028-01-31'],
                ['Tick control wash', 'Medicine', 'litres', 18, 8, '2027-03-15'],
            ] as $itemIndex => [$itemName, $category, $unit, $quantity, $reorder, $expiry]) {
                DB::table('inventory_items')->updateOrInsert(
                    ['farm_id' => $farmId, 'name' => $itemName],
                    ['id' => sprintf('d0000000-0000-4000-8000-%012d', $number * 10 + $itemIndex + 1),
                     'category' => $category, 'unit' => $unit, 'quantity' => $quantity,
                     'reorder_level' => $reorder, 'expires_on' => $expiry,
                     'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([
                ['Apply top-dressing fertilizer', 'High', '2026-11-25', 'In progress'],
                ['Service irrigation pump', 'Medium', '2026-12-02', 'Open'],
                ['Clean poultry house', 'Medium', '2026-11-21', 'Completed'],
            ] as $taskIndex => [$title, $priority, $dueDate, $status]) {
                DB::table('farm_tasks')->updateOrInsert(
                    ['id' => sprintf('e0000000-0000-4000-8000-%012d', $number * 10 + $taskIndex + 1)],
                    ['farm_id' => $farmId, 'title' => $title, 'priority' => $priority, 'due_date' => $dueDate,
                     'status' => $status, 'notes' => 'Seeded farm task.', 'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([
                ['Irrigation pump', 'Pump', 'Maintenance', '2026-11-27', 6800],
                ['Massey Ferguson tractor', 'Tractor', 'Operational', '2027-02-10', 24000],
            ] as $equipmentIndex => [$equipmentName, $category, $status, $serviceDate, $cost]) {
                DB::table('farm_equipment')->updateOrInsert(
                    ['id' => sprintf('f0000000-0000-4000-8000-%012d', $number * 10 + $equipmentIndex + 1)],
                    ['farm_id' => $farmId, 'name' => $equipmentName, 'category' => $category, 'status' => $status,
                     'next_service_date' => $serviceDate, 'maintenance_cost_kes' => $cost,
                     'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([
                ['Income', 'Milk sales', '2026-11-18', 42600, 'Njoro Dairy Cooperative'],
                ['Income', 'Egg sales', '2026-11-22', 15800, 'Local market'],
                ['Expense', 'Veterinary services', '2026-11-12', 6200, 'County Veterinary Services'],
            ] as $transactionIndex => [$type, $category, $date, $amount, $party]) {
                DB::table('farm_transactions')->updateOrInsert(
                    ['id' => sprintf('a1000000-0000-4000-8000-%012d', $number * 10 + $transactionIndex + 1)],
                    ['farm_id' => $farmId, 'type' => $type, 'category' => $category, 'transaction_date' => $date,
                     'amount_kes' => $amount, 'party' => $party, 'notes' => 'Seeded finance transaction.',
                     'created_at' => $now, 'updated_at' => $now],
                );
            }

            foreach ([0, 1] as $cropIndex) {
                $cropId = sprintf('50000000-0000-4000-8000-%012d', $number * 10 + $cropIndex + 1);
                foreach ([['Planting', '2026-10-18', 7200], ['Fertilizer', '2026-11-10', 4800]] as $activityIndex => [$type, $date, $cost]) {
                    DB::table('crop_activities')->updateOrInsert(
                        ['id' => sprintf('b0000000-0000-4000-%04d-%012d', $cropIndex + 8000, $number * 10 + $activityIndex + 1)],
                        ['farm_id' => $farmId, 'crop_season_id' => $cropId, 'type' => $type,
                         'activity_date' => $date, 'cost_kes' => $cost, 'notes' => 'Seeded crop activity.',
                         'created_at' => $now, 'updated_at' => $now],
                    );
                }
            }
        }
    }
}
