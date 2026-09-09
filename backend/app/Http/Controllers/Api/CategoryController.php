<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Category\StoreCategoryRequest;
use App\Http\Requests\Api\Category\UpdateCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\ImageManager;

class CategoryController extends Controller
{
    /**
     * Display all main categories with their subcategories.
     */
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->with([
                'subcategories' => function ($query) {
                    $query->orderBy('name');
                },
            ])
            ->whereNull('parent_id')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => CategoryResource::collection($categories),
        ]);
    }

    /**
     * Store a new category.
     *
     * parent_id = NULL
     *     => Main category
     *
     * parent_id = ID of a main category
     *     => Subcategory
     */
    public function store(
        StoreCategoryRequest $request
    ): JsonResponse {
        $data = $request->validated();

        /*
         * Generate a slug automatically when the admin
         * does not provide one.
         */
        $data['slug'] = $data['slug'] ?? Str::slug(
            $data['name']
        );

        /*
         * A subcategory must belong directly to a
         * main category.
         *
         * We do not allow a subcategory to have another
         * subcategory as its parent.
         */
        if (!empty($data['parent_id'])) {
            $parent = Category::findOrFail(
                $data['parent_id']
            );

            if (!is_null($parent->parent_id)) {
                return response()->json([
                    'message' =>
                        'A subcategory cannot be used as a parent category.',
                ], 422);
            }
        }

        /*
         * Upload and process category image if provided.
         *
         * Only one processed image is stored.
         * Maximum dimensions: 500 x 500.
         * Aspect ratio is preserved.
         */
        if ($request->hasFile('image')) {
            $data['image_path'] = $this->uploadCategoryImage(
                $request->file('image')
            );
        }

        /*
         * "image" is an uploaded file, not a database column.
         */
        unset($data['image']);

        $category = Category::create($data);

        return response()->json([
            'message' =>
                'Category created successfully.',

            'data' => new CategoryResource(
                $category->load('subcategories')
            ),
        ], 201);
    }

    /**
     * Update a category.
     */
    public function update(
        UpdateCategoryRequest $request,
        Category $category
    ): JsonResponse {
        $data = $request->validated();

        /*
         * Automatically regenerate the slug when
         * the name changes and no slug was supplied.
         */
        if (
            isset($data['name']) &&
            !isset($data['slug'])
        ) {
            $data['slug'] = Str::slug(
                $data['name']
            );
        }

        /*
         * If parent_id is being changed, make sure:
         *
         * 1. The category cannot be its own parent.
         * 2. A subcategory cannot become the parent.
         * 3. Categories remain limited to two levels.
         */
        if (array_key_exists('parent_id', $data)) {
            $parentId = $data['parent_id'];

            if ($parentId !== null) {
                if (
                    (int) $parentId ===
                    (int) $category->id
                ) {
                    return response()->json([
                        'message' =>
                            'A category cannot be its own parent.',
                    ], 422);
                }

                $parent = Category::findOrFail(
                    $parentId
                );

                if (!is_null($parent->parent_id)) {
                    return response()->json([
                        'message' =>
                            'A subcategory cannot be used as a parent category.',
                    ], 422);
                }
            }
        }

        /*
         * Upload and process a new category image.
         *
         * The previous processed image is deleted first.
         */
        if ($request->hasFile('image')) {
            if (
                $category->image_path &&
                Storage::disk('public')->exists(
                    $category->image_path
                )
            ) {
                Storage::disk('public')->delete(
                    $category->image_path
                );
            }

            $data['image_path'] = $this->uploadCategoryImage(
                $request->file('image')
            );
        }

        /*
         * "image" is the uploaded file, not a database field.
         */
        unset($data['image']);

        $category->update($data);

        return response()->json([
            'message' =>
                'Category updated successfully.',

            'data' => new CategoryResource(
                $category->fresh('subcategories')
            ),
        ]);
    }

    /**
     * Delete a category.
     *
     * If a main category is deleted:
     * - its subcategories are deleted
     * - products are NOT deleted
     * - products belonging to those subcategories have
     *   their category_id set to NULL
     *
     * If a subcategory is deleted:
     * - the subcategory is deleted
     * - its products are NOT deleted
     * - those products have their category_id set to NULL
     */
    public function destroy(
        Category $category
    ): JsonResponse {
        DB::transaction(function () use ($category) {

            /*
             * Get all direct subcategories.
             *
             * For a subcategory this will be an empty collection.
             * For a main category this contains its subcategories.
             */
            $subcategories = $category
                ->subcategories()
                ->get();

            /*
             * Build the list of category IDs whose products
             * must be preserved.
             *
             * This includes:
             * - the category being deleted
             * - all direct subcategories
             */
            $categoryIds = $subcategories
                ->pluck('id')
                ->push($category->id)
                ->unique()
                ->values();

            /*
             * IMPORTANT:
             *
             * Explicitly detach products from these categories
             * BEFORE deleting the categories.
             *
             * This guarantees that products are preserved.
             * Their category_id becomes NULL.
             *
             * We do NOT delete any Product records here.
             */
            Product::query()
                ->whereIn('category_id', $categoryIds)
                ->update([
                    'category_id' => null,
                ]);

            /*
             * Delete subcategory images and subcategories.
             */
            foreach ($subcategories as $subcategory) {
                if (
                    $subcategory->image_path &&
                    Storage::disk('public')->exists(
                        $subcategory->image_path
                    )
                ) {
                    Storage::disk('public')->delete(
                        $subcategory->image_path
                    );
                }

                $subcategory->delete();
            }

            /*
             * Delete the main category/subcategory image.
             */
            if (
                $category->image_path &&
                Storage::disk('public')->exists(
                    $category->image_path
                )
            ) {
                Storage::disk('public')->delete(
                    $category->image_path
                );
            }

            /*
             * Delete the category itself.
             *
             * Products have already been detached above,
             * so no Product records are deleted.
             */
            $category->delete();
        });

        return response()->json([
            'message' =>
                'Category and its subcategories deleted successfully.',
        ]);
    }

    /**
     * Process and store a category image.
     *
     * Only one processed image is stored for each category.
     *
     * Maximum dimensions: 500 x 500.
     * Aspect ratio is preserved.
     * Smaller images are not enlarged.
     *
     * JPEG/JPG: quality 85
     * PNG: PNG encoding
     * WebP: quality 85
     */
    private function uploadCategoryImage(
        UploadedFile $image
    ): string {
        $manager = new ImageManager(
            new GdDriver()
        );

        $extension = strtolower(
            $image->getClientOriginalExtension()
        );

        $allowedExtensions = [
            'jpg',
            'jpeg',
            'png',
            'webp',
        ];

        if (!in_array(
            $extension,
            $allowedExtensions,
            true
        )) {
            throw new \RuntimeException(
                'Unsupported image format.'
            );
        }

        $filename = (string) Str::uuid();

        $imagePath =
            "categories/{$filename}.{$extension}";

        /*
         * Resize the image to a maximum of 500 x 500
         * while preserving the original aspect ratio.
         *
         * scaleDown() also prevents smaller images
         * from being enlarged.
         */
        $processedImage = $manager
            ->decodeSplFileInfo($image)
            ->scaleDown(
                width: 500,
                height: 500
            );

        /*
         * Encode the processed image using the same
         * format/quality approach as ProductController.
         */
        $encoded = match ($extension) {
            'jpg',
            'jpeg' => $processedImage->encodeUsingFileExtension(
                'jpg',
                quality: 85
            ),

            'png' => $processedImage->encodeUsingFileExtension(
                'png'
            ),

            'webp' => $processedImage->encodeUsingFileExtension(
                'webp',
                quality: 85
            ),
        };

        /*
         * Store only the processed image.
         */
        Storage::disk('public')->put(
            $imagePath,
            (string) $encoded
        );

        return $imagePath;
    }
}