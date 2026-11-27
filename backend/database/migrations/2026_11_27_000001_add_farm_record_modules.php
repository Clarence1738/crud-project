<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tables for the functions that were preview screens: harvests, incidents, breeding, births,
 * measurements, stock locations, suppliers, stock movements, maintenance, farm settings,
 * audit events, and the System Administrator account flags (DESIGN 3.2).
 */
return new class extends Migration
{
    public function up(): void
    {
        $farmRecord = function (Blueprint $t): void {
            $t->uuid('id')->primary();
            $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
        };

        Schema::create('crop_harvests', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('crop_season_id')->constrained()->cascadeOnDelete();
            $t->date('harvest_date');
            $t->decimal('quantity_kg', 12, 2);
            $t->decimal('loss_kg', 12, 2)->default(0);
            $t->string('grade', 20);
            $t->string('destination', 20);
            $t->string('storage_location', 100)->nullable();
            $t->timestamps();
        });
        Schema::create('crop_incidents', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('crop_season_id')->constrained()->cascadeOnDelete();
            $t->string('type', 20);
            $t->date('incident_date');
            $t->decimal('affected_area_ha', 10, 2)->nullable();
            $t->decimal('loss_kg', 12, 2)->default(0);
            $t->text('description');
            $t->text('corrective_action')->nullable();
            $t->timestamps();
        });
        Schema::create('breeding_events', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('female_id')->constrained('livestock_records')->cascadeOnDelete();
            $t->string('sire', 120)->nullable();
            $t->date('bred_on');
            $t->string('method', 40);
            $t->string('pregnancy_result', 20)->default('Pending');
            $t->date('expected_birth_on')->nullable();
            $t->timestamps();
        });
        Schema::create('birth_events', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('dam_id')->constrained('livestock_records')->cascadeOnDelete();
            $t->date('born_on');
            $t->unsignedInteger('born_alive');
            $t->unsignedInteger('born_dead')->default(0);
            $t->string('offspring', 200)->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });
        Schema::create('livestock_measurements', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('livestock_record_id')->constrained()->cascadeOnDelete();
            $t->date('measured_on');
            $t->string('kind', 20);
            $t->decimal('value', 12, 2);
            $t->string('unit', 20);
            $t->timestamps();
        });
        Schema::create('stock_locations', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->string('name', 100);
            $t->string('kind', 20);
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->unique(['farm_id', 'name']);
        });
        Schema::create('suppliers', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->string('name', 120);
            $t->string('kind', 20);
            $t->string('phone', 40)->nullable();
            $t->string('email', 160)->nullable();
            $t->text('products')->nullable();
            $t->timestamps();
            $t->unique(['farm_id', 'name']);
        });
        Schema::create('stock_movements', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('inventory_item_id')->constrained()->cascadeOnDelete();
            $t->string('type', 20);
            $t->decimal('quantity', 14, 2);
            $t->decimal('balance_after', 14, 2);
            $t->date('moved_on');
            $t->string('location', 100)->nullable();
            $t->string('supplier', 120)->nullable();
            $t->text('reason')->nullable();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('maintenance_records', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignUuid('farm_equipment_id')->constrained('farm_equipment')->cascadeOnDelete();
            $t->date('serviced_on');
            $t->text('work_done');
            $t->string('provider', 120)->nullable();
            $t->decimal('cost_kes', 12, 2)->default(0);
            $t->decimal('downtime_hours', 8, 2)->nullable();
            $t->date('next_service_date')->nullable();
            $t->timestamps();
        });
        Schema::create('farm_settings', function (Blueprint $t): void {
            $t->foreignUuid('farm_id')->primary()->constrained()->cascadeOnDelete();
            $t->unsignedSmallInteger('reminder_days')->default(7);
            $t->boolean('manager_finance_access')->default(false);
            $t->string('season_start_month', 12)->default('March');
            $t->timestamps();
        });
        Schema::create('audit_events', function (Blueprint $t) use ($farmRecord): void {
            $farmRecord($t);
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action', 20);
            $t->string('record_type', 40);
            $t->string('summary', 255);
            $t->timestamp('occurred_at')->index();
        });
        Schema::table('users', function (Blueprint $t): void {
            $t->boolean('is_admin')->default(false);
            $t->timestamp('suspended_at')->nullable();
            $t->timestamp('last_login_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['is_admin', 'suspended_at', 'last_login_at']));
        foreach (['audit_events', 'farm_settings', 'maintenance_records', 'stock_movements', 'suppliers', 'stock_locations',
            'livestock_measurements', 'birth_events', 'breeding_events', 'crop_incidents', 'crop_harvests'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
