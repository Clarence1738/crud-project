<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('farms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('county', 80);
            $table->string('location', 160)->nullable();
            $table->decimal('size_hectares', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['owner_id', 'name']);
        });
        Schema::create('farm_memberships', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->timestamps();
            $table->unique(['farm_id', 'user_id']);
        });
        Schema::create('crop_seasons', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $table->string('crop', 80);
            $table->string('variety', 80)->nullable();
            $table->string('field_name', 100);
            $table->decimal('area_hectares', 10, 2);
            $table->date('planted_on')->nullable();
            $table->date('expected_harvest_date')->nullable();
            $table->string('status', 20)->default('Planned');
            $table->decimal('expected_yield_kg', 12, 2)->nullable();
            $table->decimal('harvested_kg', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['farm_id', 'status']);
        });
        Schema::create('livestock_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $table->string('tracking_type', 20);
            $table->string('tag_number', 60)->nullable();
            $table->string('group_name', 100)->nullable();
            $table->string('species', 60);
            $table->string('breed', 80)->nullable();
            $table->string('sex', 20)->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->date('birth_date')->nullable();
            $table->string('status', 20)->default('Active');
            $table->string('location', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['farm_id', 'tag_number']);
            $table->index(['farm_id', 'species', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('livestock_records');
        Schema::dropIfExists('crop_seasons');
        Schema::dropIfExists('farm_memberships');
        Schema::dropIfExists('farms');
    }
};
