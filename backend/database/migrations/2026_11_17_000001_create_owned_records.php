<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transports', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('customer', 120);
            $table->string('origin', 100);
            $table->string('destination', 100);
            $table->string('vehicle', 30);
            $table->date('date');
            $table->string('status', 20);
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
        Schema::create('documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('title', 120);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 120);
            $table->unsignedBigInteger('size');
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
        Schema::dropIfExists('transports');
    }
};
