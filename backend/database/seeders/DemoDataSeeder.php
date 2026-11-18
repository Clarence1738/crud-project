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
            foreach (['Alice Demo', 'Brian Demo'] as $account => $name) {
                $user = User::firstOrCreate(
                    ['email' => 'demo'.($account + 1).'@nextrans.test'],
                    ['name' => $name, 'password' => 'NextransDemo2026!']
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
                        'origin' => $origin,
                        'destination' => $destination,
                        'vehicle' => 'KDA '.($account + 1).($index + 1).'0A',
                        'date' => '2026-11-'.(18 + $index),
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
            }
        });
    }
}
