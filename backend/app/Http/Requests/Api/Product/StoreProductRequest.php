<?php

namespace App\Http\Requests\Api\Product;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine whether the user is authorized
     * to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            /*
            |--------------------------------------------------------------------------
            | Category
            |--------------------------------------------------------------------------
            |
            | Every product must belong to a SUBCATEGORY.
            |
            | A main category has:
            |     parent_id = NULL
            |
            | A subcategory has:
            |     parent_id != NULL
            |
            | Therefore the selected category_id must belong
            | to a category whose parent_id is not NULL.
            |
            */

            'category_id' => [
                'required',
                'integer',
                Rule::exists('categories', 'id')
                    ->whereNotNull('parent_id'),
            ],

            /*
            |--------------------------------------------------------------------------
            | Product information
            |--------------------------------------------------------------------------
            */

            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'sku' => [
                'required',
                'string',
                'max:100',
                'unique:products,sku',
            ],

            'brand' => [
                'nullable',
                'string',
                'max:255',
            ],

            /*
            |--------------------------------------------------------------------------
            | Pricing
            |--------------------------------------------------------------------------
            */

            'price' => [
                'required',
                'numeric',
                'min:0.01',
            ],

            'discount_price' => [
                'nullable',
                'numeric',
                'min:0',
                'lte:price',
            ],

            /*
            |--------------------------------------------------------------------------
            | Inventory
            |--------------------------------------------------------------------------
            */

            'stock_qty' => [
                'required',
                'integer',
                'min:0',
            ],

            /*
            |--------------------------------------------------------------------------
            | Description
            |--------------------------------------------------------------------------
            */

            'description' => [
                'required',
                'string',
            ],

            /*
            |--------------------------------------------------------------------------
            | Specifications
            |--------------------------------------------------------------------------
            */

            'specifications' => [
                'nullable',
                'array',
            ],

            'specifications.*' => [
                'nullable',
            ],

            /*
            |--------------------------------------------------------------------------
            | Warranty
            |--------------------------------------------------------------------------
            */

            'warranty_months' => [
                'nullable',
                'integer',
                'min:0',
                'max:240',
            ],

            /*
            |--------------------------------------------------------------------------
            | Status
            |--------------------------------------------------------------------------
            */

            'status' => [
                'required',
                Rule::in([
                    'active',
                    'inactive',
                    'draft',
                ]),
            ],

            /*
            |--------------------------------------------------------------------------
            | Product images
            |--------------------------------------------------------------------------
            */

            'images' => [
                'required',
                'array',
                'min:1',
                'max:8',
            ],

            'images.*' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'category_id.required' =>
                'Please select a product subcategory.',

            'category_id.integer' =>
                'The selected product subcategory is invalid.',

            'category_id.exists' =>
                'The selected category must be a valid subcategory.',

            'name.required' =>
                'Please enter a product name.',

            'sku.required' =>
                'Please enter a product SKU.',

            'sku.unique' =>
                'This SKU is already being used.',

            'price.required' =>
                'Please enter a product price.',

            'price.min' =>
                'The product price must be at least 0.01.',

            'discount_price.numeric' =>
                'The discount price must be a valid number.',

            'discount_price.min' =>
                'The discount price cannot be negative.',

            'discount_price.lte' =>
                'The discount price cannot be greater than the regular price.',

            'stock_qty.required' =>
                'Please enter the stock quantity.',

            'stock_qty.integer' =>
                'The stock quantity must be a whole number.',

            'stock_qty.min' =>
                'The stock quantity cannot be negative.',

            'description.required' =>
                'Please enter a product description.',

            'specifications.array' =>
                'Product specifications must be provided as a valid list.',

            'warranty_months.integer' =>
                'Warranty duration must be a whole number of months.',

            'warranty_months.min' =>
                'Warranty duration cannot be negative.',

            'warranty_months.max' =>
                'Warranty duration cannot exceed 240 months.',

            'images.required' =>
                'Please select a product image.',

            'images.array' =>
                'The selected product images are invalid.',

            'images.min' =>
                'Please select at least one product image.',

            'images.max' =>
                'You may upload a maximum of 8 images.',

            'images.*.image' =>
                'Every uploaded file must be an image.',

            'images.*.mimes' =>
                'Images must be JPG, JPEG, PNG, or WebP.',

            'images.*.max' =>
                'Each image must not be larger than 5 MB.',
        ];
    }
}