<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Interaction;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // crear usuario admin
        $admin = User::firstOrCreate([
            'email' => 'admin@example.com'
        ],[
            'name' => 'Admin',
            'password' => Hash::make('password')
        ]);

        Customer::factory()->count(10)->create()->each(function($customer){
            Interaction::factory()->count(2)->create(['customer_id' => $customer->id]);
            Order::factory()->count(1)->create(['customer_id' => $customer->id]);
        });
    }
}
