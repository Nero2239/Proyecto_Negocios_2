<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Evaluation extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id','score','last_contact_at','lifetime_value','notes'
    ];

    protected $casts = [
        'last_contact_at' => 'datetime',
        'lifetime_value' => 'decimal:2'
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
