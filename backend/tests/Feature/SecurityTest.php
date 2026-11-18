<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private function transportData(): array
    {
        return ['customer' => 'Acme', 'origin' => 'Nairobi', 'destination' => 'Mombasa',
            'vehicle' => 'KDA 123A', 'date' => '2026-11-18', 'status' => 'Scheduled'];
    }

    public function test_registration_hashes_password_and_logout_revokes_access(): void
    {
        $this->postJson('/api/register', ['name' => 'Alice', 'email' => 'Alice@example.com',
            'password' => 'StrongPassword123!', 'password_confirmation' => 'StrongPassword123!'])
            ->assertCreated()->assertJsonMissingPath('data.password');
        $user = User::firstOrFail();
        $this->assertSame('alice@example.com', $user->email);
        $this->assertTrue(Hash::check('StrongPassword123!', $user->password));
        $this->getJson('/api/me')->assertOk();
        $this->postJson('/api/logout')->assertNoContent();
        $this->getJson('/api/me')->assertUnauthorized();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong'])
            ->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'StrongPassword123!'])->assertOk();
    }

    public function test_login_is_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/login', ['email' => 'missing@example.com', 'password' => 'wrong'])
                ->assertUnprocessable();
        }
        $this->postJson('/api/login', ['email' => 'missing@example.com', 'password' => 'wrong'])
            ->assertTooManyRequests();
    }

    public function test_guests_cannot_access_records_or_uploads(): void
    {
        $this->getJson('/api/transports')->assertUnauthorized();
        $this->postJson('/api/transports', $this->transportData())->assertUnauthorized();
        $this->getJson('/api/documents')->assertUnauthorized();
        $this->postJson('/api/documents')->assertUnauthorized();
    }

    public function test_transport_crud_is_owned_and_rejects_owner_forgery(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $id = $this->actingAs($alice)->postJson('/api/transports', $this->transportData())
            ->assertCreated()->json('data.id');
        $this->assertDatabaseHas('transports', ['id' => $id, 'user_id' => $alice->id]);
        $this->actingAs($bob)->getJson('/api/transports')->assertJsonCount(0, 'data');
        $this->getJson('/api/transports/'.$id)->assertNotFound();
        $this->putJson('/api/transports/'.$id, $this->transportData())->assertNotFound();
        $this->deleteJson('/api/transports/'.$id)->assertNotFound();
        $this->postJson('/api/transports', [...$this->transportData(), 'user_id' => $alice->id])
            ->assertUnprocessable();
        $this->actingAs($alice)->getJson('/api/transports/'.$id)->assertOk();
        $this->putJson('/api/transports/'.$id, [...$this->transportData(), 'status' => 'Delivered'])
            ->assertOk()->assertJsonPath('data.status', 'Delivered');
        $this->putJson('/api/transports/'.$id, [...$this->transportData(), 'date' => 'invalid'])
            ->assertUnprocessable();
        $this->deleteJson('/api/transports/'.$id)->assertNoContent();
        $this->assertDatabaseMissing('transports', ['id' => $id]);
    }

    public function test_private_documents_enforce_ownership_for_every_operation(): void
    {
        Storage::fake('private');
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $id = $this->actingAs($alice)->postJson('/api/documents', [
            'title' => 'Receipt', 'file' => UploadedFile::fake()->createWithContent('receipt.txt', 'Private contents'),
        ])->assertCreated()->assertJsonMissingPath('data.path')->json('data.id');
        $document = Document::findOrFail($id);
        $oldPath = $document->path;
        Storage::disk('private')->assertExists($oldPath);
        $this->actingAs($bob)->getJson('/api/documents')->assertJsonCount(0, 'data');
        $this->getJson('/api/documents/'.$id)->assertNotFound();
        $this->getJson('/api/documents/'.$id.'/download')->assertNotFound();
        $this->putJson('/api/documents/'.$id, ['title' => 'Stolen'])->assertNotFound();
        $this->deleteJson('/api/documents/'.$id)->assertNotFound();
        Storage::disk('private')->assertExists($oldPath);
        $this->actingAs($alice)->getJson('/api/documents/'.$id.'/download')
            ->assertOk()->assertDownload('receipt.txt')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->putJson('/api/documents/'.$id, ['title' => 'Updated'])->assertOk();
        $this->postJson('/api/documents/'.$id, ['_method' => 'PUT', 'title' => 'Replacement',
            'file' => UploadedFile::fake()->createWithContent('new.txt', 'Replacement contents')])->assertOk();
        Storage::disk('private')->assertMissing($oldPath);
        $newPath = $document->fresh()->path;
        Storage::disk('private')->assertExists($newPath);
        $this->deleteJson('/api/documents/'.$id)->assertNoContent();
        Storage::disk('private')->assertMissing($newPath);
        $this->assertDatabaseMissing('documents', ['id' => $id]);
    }

    public function test_upload_validation_rejects_scripts_oversized_files_and_owner_input(): void
    {
        Storage::fake('private');
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/documents', ['title' => 'Script',
            'file' => UploadedFile::fake()->createWithContent('script.php', '<?php echo "bad";')])
            ->assertUnprocessable();
        $this->postJson('/api/documents', ['title' => 'Large',
            'file' => UploadedFile::fake()->create('large.pdf', 10241, 'application/pdf')])
            ->assertUnprocessable();
        $this->postJson('/api/documents', ['title' => 'Forged', 'user_id' => 99,
            'file' => UploadedFile::fake()->createWithContent('test.txt', 'data')])->assertUnprocessable();
        $this->assertDatabaseCount('documents', 0);
        $this->assertSame([], Storage::disk('private')->allFiles());
    }

    public function test_only_owner_can_change_shipment_status(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $id = $this->actingAs($owner)->postJson('/api/transports', $this->transportData())->json('data.id');
        $this->actingAs($other)->patchJson('/api/transports/'.$id.'/status', ['status' => 'Delivered'])->assertNotFound();
        $this->assertDatabaseHas('transports', ['id' => $id, 'status' => 'Scheduled']);
        $this->actingAs($owner)->patchJson('/api/transports/'.$id.'/status', ['status' => 'Unknown'])->assertUnprocessable();
        $this->patchJson('/api/transports/'.$id.'/status', ['status' => 'In transit'])->assertOk()->assertJsonPath('data.status', 'In transit');
        $this->patchJson('/api/transports/'.$id.'/status', ['status' => 'Delivered'])->assertOk()->assertJsonPath('data.status', 'Delivered');
        $this->assertDatabaseHas('transports', ['id' => $id, 'status' => 'Delivered', 'customer' => 'Acme']);
    }

    public function test_csrf_is_required_for_mutations(): void
    {
        // Laravel bypasses CSRF during ordinary tests; change only the runtime environment for this request.
        $this->app->instance('env', 'local');
        $this->postJson('/api/login', ['email' => 'user@example.com', 'password' => 'wrong'])
            ->assertStatus(419);
    }
}
