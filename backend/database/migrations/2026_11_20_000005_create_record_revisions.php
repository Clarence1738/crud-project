<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_revisions', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('resource', 16);
            $table->unsignedBigInteger('revision');
            $table->primary(['user_id', 'resource']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE FUNCTION bump_record_revision() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF TG_OP <> 'INSERT' THEN
                        INSERT INTO record_revisions VALUES (OLD.user_id, TG_TABLE_NAME, 1)
                        ON CONFLICT (user_id, resource) DO UPDATE SET revision = record_revisions.revision + 1;
                    END IF;
                    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id) THEN
                        INSERT INTO record_revisions VALUES (NEW.user_id, TG_TABLE_NAME, 1)
                        ON CONFLICT (user_id, resource) DO UPDATE SET revision = record_revisions.revision + 1;
                    END IF;
                    RETURN NULL;
                END;
                $$;
                SQL);

            foreach (['transports', 'documents'] as $table) {
                DB::unprepared("CREATE TRIGGER track_record_revision AFTER INSERT OR UPDATE OR DELETE ON {$table}
                    FOR EACH ROW EXECUTE FUNCTION bump_record_revision()");
            }

            return;
        }

        // The test suite also runs these triggers on SQLite.
        foreach (['transports', 'documents'] as $table) {
            foreach (['INSERT' => 'NEW', 'UPDATE' => 'OLD', 'DELETE' => 'OLD'] as $event => $row) {
                $bump = fn (string $row): string => "INSERT INTO record_revisions (user_id, resource, revision)
                    VALUES ({$row}.user_id, '{$table}', 1)
                    ON CONFLICT (user_id, resource) DO UPDATE SET revision = revision + 1;";
                DB::unprepared("CREATE TRIGGER track_{$table}_{$event} AFTER {$event} ON {$table}
                    BEGIN {$bump($row)} END");
            }
            DB::unprepared("CREATE TRIGGER track_{$table}_new_owner AFTER UPDATE OF user_id ON {$table}
                WHEN NEW.user_id <> OLD.user_id BEGIN {$bump('NEW')} END");
        }
    }

    public function down(): void
    {
        foreach (['transports', 'documents'] as $table) {
            if (DB::getDriverName() === 'pgsql') {
                DB::unprepared("DROP TRIGGER track_record_revision ON {$table}");
            } else {
                foreach (['INSERT', 'UPDATE', 'DELETE', 'new_owner'] as $event) {
                    DB::unprepared("DROP TRIGGER track_{$table}_{$event}");
                }
            }
        }
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP FUNCTION bump_record_revision()');
        }
        Schema::dropIfExists('record_revisions');
    }
};
