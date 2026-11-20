<?php

namespace App\Console\Commands;

use App\Models\Transport;
use App\Models\User;
use App\Shipments\TransportQueries;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BenchmarkShipments extends Command
{
    protected $signature = 'shipments:benchmark {--rows=5000}';

    protected $description = 'Measure shipment queries in an empty throwaway PostgreSQL database';

    public function handle(TransportQueries $queries): int
    {
        if (! app()->environment('testing') || DB::connection()->getDriverName() !== 'pgsql'
            || User::query()->exists() || Transport::query()->exists()) {
            $this->error('The benchmark requires an empty PostgreSQL database in the testing environment.');

            return self::FAILURE;
        }

        $rows = filter_var($this->option('rows'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 100, 'max_range' => 100000]]);
        if ($rows === false) {
            $this->error('Use a row count between 100 and 100000.');

            return self::FAILURE;
        }

        DB::beginTransaction();
        try {
            $owner = User::factory()->create();
            DB::insert("INSERT INTO transports
                (id, user_id, customer, sender_company, recipient_company, origin, destination,
                 vehicle, date, expected_arrival_date, status, reference, created_at, updated_at)
                SELECT gen_random_uuid(), ?, 'Benchmark', 'Warehouse ' || (n % 50),
                    'Receiver ' || (n % 100), 'Nairobi', 'Mombasa', 'TEST',
                    current_date - 7, CASE WHEN n % 11 <> 0 THEN current_date + (n % 31) - 8 END,
                    (ARRAY['Scheduled','In transit','Delivered'])[(n % 3) + 1],
                    'BENCH-' || n, now() - (n * interval '1 second'), now()
                FROM generate_series(1, CAST(? AS integer)) AS n", [$owner->id, $rows]);
            DB::statement('ANALYZE transports');

            $this->info("Benchmarking {$rows} shipments. Times include Eloquent mapping where applicable.");
            $this->measure('Register and exception counts', fn () => $queries->page($owner->id, []));
            $this->measure('Reference search', fn () => $queries->page($owner->id, ['search' => 'BENCH-'.($rows - 2)]));
            $this->measure('Seven-day calendar', fn () => $queries->calendar(
                $owner->id, now()->toDateString(), now()->addDays(6)->toDateString()
            ));
        } finally {
            DB::rollBack();
        }

        return self::SUCCESS;
    }

    private function measure(string $label, callable $query): void
    {
        $connection = DB::connection();
        $connection->flushQueryLog();
        $connection->enableQueryLog();
        $started = hrtime(true);
        try {
            $query();
        } finally {
            $connection->disableQueryLog();
        }
        $this->line(sprintf('%s: %.2f ms', $label, (hrtime(true) - $started) / 1e6));
        foreach ($connection->getQueryLog() as $record) {
            $plan = $connection->select('EXPLAIN (ANALYZE, BUFFERS) '.$record['query'], $record['bindings']);
            foreach ($plan as $step) {
                $this->line('  '.$step->{'QUERY PLAN'});
            }
        }
    }
}
