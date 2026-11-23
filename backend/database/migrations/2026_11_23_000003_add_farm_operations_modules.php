<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farm_fields', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->string('name',100); $t->decimal('size_hectares',10,2); $t->string('soil_type',80)->nullable();
            $t->string('status',20)->default('Available'); $t->text('notes')->nullable(); $t->timestamps();
            $t->unique(['farm_id','name']);
        });
        Schema::table('crop_seasons', function (Blueprint $t): void {
            $t->foreignUuid('field_id')->nullable()->after('farm_id')->constrained('farm_fields')->nullOnDelete();
            $t->timestamp('archived_at')->nullable()->index();
        });
        Schema::table('livestock_records', function (Blueprint $t): void { $t->timestamp('archived_at')->nullable()->index(); });
        Schema::create('crop_activities', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('crop_season_id')->constrained()->cascadeOnDelete(); $t->string('type',40);
            $t->date('activity_date'); $t->decimal('cost_kes',12,2)->default(0); $t->text('notes')->nullable(); $t->timestamps();
        });
        Schema::create('livestock_events', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('livestock_record_id')->constrained()->cascadeOnDelete(); $t->string('type',40);
            $t->date('event_date'); $t->date('next_due_date')->nullable(); $t->decimal('cost_kes',12,2)->default(0);
            $t->string('medicine',120)->nullable(); $t->text('notes')->nullable(); $t->timestamps();
        });
        Schema::create('inventory_items', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->string('name',120); $t->string('category',40); $t->string('unit',20);
            $t->decimal('quantity',14,2)->default(0); $t->decimal('reorder_level',14,2)->default(0);
            $t->date('expires_on')->nullable(); $t->timestamps(); $t->unique(['farm_id','name']);
        });
        Schema::create('farm_tasks', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->string('title',160); $t->string('priority',20)->default('Medium'); $t->date('due_date')->nullable();
            $t->string('status',20)->default('Open'); $t->text('notes')->nullable(); $t->timestamps();
        });
        Schema::create('farm_equipment', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->string('name',120); $t->string('category',60); $t->string('status',20)->default('Operational');
            $t->date('next_service_date')->nullable(); $t->decimal('maintenance_cost_kes',12,2)->default(0); $t->timestamps();
        });
        Schema::create('farm_transactions', function (Blueprint $t): void {
            $t->uuid('id')->primary(); $t->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $t->string('type',10); $t->string('category',60); $t->date('transaction_date');
            $t->decimal('amount_kes',14,2); $t->string('party',120)->nullable(); $t->text('notes')->nullable(); $t->timestamps();
        });
    }
    public function down(): void
    {
        Schema::dropIfExists('farm_transactions'); Schema::dropIfExists('farm_equipment'); Schema::dropIfExists('farm_tasks');
        Schema::dropIfExists('inventory_items'); Schema::dropIfExists('livestock_events'); Schema::dropIfExists('crop_activities');
        Schema::table('livestock_records', fn(Blueprint $t) => $t->dropColumn('archived_at'));
        Schema::table('crop_seasons', function(Blueprint $t): void { $t->dropForeign(['field_id']); $t->dropColumn(['field_id','archived_at']); });
        Schema::dropIfExists('farm_fields');
    }
};
