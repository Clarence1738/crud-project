<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farm_invitations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('farm_id')->constrained()->cascadeOnDelete();
            $table->string('email', 255);
            $table->string('role', 20);
            $table->string('token_hash', 64)->unique();
            $table->foreignId('invited_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['farm_id', 'email']);
        });

        Schema::table('farm_tasks', function (Blueprint $table): void {
            $table->foreignId('assignee_id')->nullable()->after('farm_id')->constrained('users')->nullOnDelete();
            $table->index(['farm_id', 'assignee_id']);
        });
    }

    public function down(): void
    {
        Schema::table('farm_tasks', function (Blueprint $table): void {
            $table->dropForeign(['assignee_id']);
            $table->dropIndex(['farm_id', 'assignee_id']);
            $table->dropColumn('assignee_id');
        });
        Schema::dropIfExists('farm_invitations');
    }
};
