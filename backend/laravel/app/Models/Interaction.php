<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Interaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id', 'user_id', 'type', 'channel', 'note', 'occurred_at'
    ];

    protected $dates = ['occurred_at'];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function user()
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
