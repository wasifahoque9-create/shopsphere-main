"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Spinner";
import { adminApi } from "@/lib/api";
import type { Category } from "@/types";

type MainCategory = {
  id: number;
  name: string;
  slug?: string;
  parent_id?: number | null;
  image_url?: string | null;
  subcategories?: Category[];
  children?: Category[];
};

type Subcategory = Category & {
  parent_id?: number | null;
};

type CategoryForm = {
  name: string;
  slug: string;
  parent_id: string;
  image: File | null;
};

export default function AdminCategoriesPage() {
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<CategoryForm>({
    name: "",
    slug: "",
    parent_id: "",
    image: null,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);

  /*
   * Convert the API response into:
   *
   * mainCategories = main categories
   * subcategories = all subcategories
   *
   * The backend /categories endpoint returns main categories
   * with their nested subcategories.
   */
  function processCategories(data: Category[]) {
    const mains = data as MainCategory[];

    const subs: Subcategory[] = [];

    mains.forEach((mainCategory) => {
      const nested =
        Array.isArray(mainCategory.subcategories)
          ? mainCategory.subcategories
          : Array.isArray(mainCategory.children)
            ? mainCategory.children
            : [];

      nested.forEach((subcategory) => {
        subs.push({
          ...subcategory,
          parent_id:
            subcategory.parent_id ?? mainCategory.id,
        });
      });
    });

    setMainCategories(mains);
    setSubcategories(subs);
  }

  async function loadCategories() {
    const data = await adminApi.categories.list();

    processCategories(data);
  }

  useEffect(() => {
    loadCategories().finally(() => setLoading(false));
  }, []);

  /*
   * Create a lookup object so we can display:
   *
   * Subcategory | Main Category
   *
   * without making another API request.
   */
  const mainCategoryMap = useMemo(() => {
    const map = new Map<number, string>();

    mainCategories.forEach((category) => {
      map.set(category.id, category.name);
    });

    return map;
  }, [mainCategories]);

  function resetForm() {
    setForm({
      name: "",
      slug: "",
      parent_id: "",
      image: null,
    });

    setEditingId(null);
    setImagePreview(null);
    setShowForm(false);
  }

  function startAdd() {
    setForm({
      name: "",
      slug: "",
      parent_id: "",
      image: null,
    });

    setEditingId(null);
    setImagePreview(null);
    setShowForm(true);
  }

  function startEdit(subcategory: Subcategory) {
    setForm({
      name: subcategory.name,
      slug: subcategory.slug,
      parent_id: subcategory.parent_id
        ? String(subcategory.parent_id)
        : "",
      image: null,
    });

    setEditingId(subcategory.id);
    setShowForm(true);

    setImagePreview(subcategory.image_url ?? null);
  }

  function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please select a JPG, JPEG, PNG, or WEBP image.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    setForm((prev) => ({
      ...prev,
      image: file,
    }));

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!form.parent_id) {
      alert(
        "Please select a Product by Category (main category).",
      );
      return;
    }

    if (mainCategories.length === 0) {
      alert(
        "No Product by Category exists yet. Please create a main category first.",
      );
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("slug", form.slug);
      formData.append("parent_id", form.parent_id);

      if (form.image) {
        formData.append("image", form.image);
      }

      if (editingId !== null) {
        await adminApi.categories.update(
          editingId,
          formData,
        );
      } else {
        await adminApi.categories.create(formData);
      }

      await loadCategories();

      resetForm();
    } catch (error) {
      console.error(
        "Unable to save shop category:",
        error,
      );

      if (error instanceof Error) {
        alert(
          `Unable to save shop category: ${error.message}`,
        );
      } else {
        alert(
          "Unable to save shop category. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    const subcategory = subcategories.find(
      (category) => category.id === id,
    );

    if (!subcategory) {
      return;
    }

    const confirmed = confirm(
      `Delete "${subcategory.name}" from Shop by Category?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await adminApi.categories.delete(id);

      setSubcategories((prev) =>
        prev.filter(
          (category) => category.id !== id,
        ),
      );

      if (editingId === id) {
        resetForm();
      }

      alert("Shop by Category deleted successfully.");

      /*
       * Reload the complete category structure so the
       * frontend stays synchronized with the backend.
       */
      await loadCategories();
    } catch (error) {
      console.error(
        "Unable to delete shop category:",
        error,
      );

      if (error instanceof Error) {
        alert(
          `Unable to delete shop category: ${error.message}`,
        );
      } else {
        alert(
          "Unable to delete shop category. Please try again.",
        );
      }
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div>
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#F59E0B]">
            Category Management
          </p>

          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            Shop by Category
          </h1>

          {!showForm && (
            <p className="mt-2 text-muted">
              Manage subcategories and assign each one to a
              Product by Category.
            </p>
          )}
        </div>

        {showForm ? (
          <Button
            variant="outline"
            onClick={resetForm}
          >
            Back to Shop by Category
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={startAdd}
          >
            + Add Shop Category
          </Button>
        )}
      </div>

      {/* No main categories warning */}
      {!showForm && mainCategories.length === 0 && (
        <Card
          className="mt-8 border-amber-200 bg-amber-50"
          padding="md"
        >
          <h2 className="font-semibold text-amber-900">
            No Product by Category found
          </h2>

          <p className="mt-1 text-sm text-amber-800">
            Create a main category from{" "}
            <strong>Categories → Products by Category</strong>{" "}
            before creating a Shop by Category subcategory.
          </p>
        </Card>
      )}

      {/* Add/Edit Shop by Category form */}
      {showForm && (
        <Card
          className="mt-8 max-w-lg"
          padding="md"
        >
          <CardHeader
            title={
              editingId !== null
                ? "Edit Shop by Category"
                : "Create Shop by Category"
            }
          />

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Subcategory name */}
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;

                setForm({
                  ...form,
                  name,
                  slug: name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, ""),
                });
              }}
            />

            {/* Subcategory slug */}
            <Input
              label="Slug"
              required
              value={form.slug}
              onChange={(e) =>
                setForm({
                  ...form,
                  slug: e.target.value,
                })
              }
            />

            {/* Main Category */}
            <div>
              <label
                htmlFor="product-by-category"
                className="mb-2 block text-sm font-medium"
              >
                Product by Category
                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>

              <select
                id="product-by-category"
                required
                value={form.parent_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    parent_id: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#121358] focus:ring-2 focus:ring-[#121358]/10"
              >
                <option value="">
                  Select a Product by Category
                </option>

                {mainCategories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category image */}
            <div>
              <label
                htmlFor="category-image"
                className="mb-2 block text-sm font-medium"
              >
                Category Image
              </label>

              <input
                id="category-image"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                className="block w-full cursor-pointer rounded-lg border border-border bg-white px-3 py-2 text-sm text-gray-700 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#121358] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />

              <p className="mt-1.5 text-xs text-muted">
                JPG, JPEG, PNG or WEBP. Maximum size: 5 MB.
              </p>
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="rounded-xl border border-border bg-gray-50 p-4">
                <p className="mb-3 text-sm font-medium">
                  {form.image
                    ? "Selected Image"
                    : "Current Category Image"}
                </p>

                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-lg bg-white">
                  <img
                    src={imagePreview}
                    alt="Category preview"
                    className="h-full w-full object-contain p-3"
                  />
                </div>

                {form.image && (
                  <p className="mt-2 truncate text-xs text-muted">
                    {form.image.name}
                  </p>
                )}
              </div>
            )}

            {/* Form buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                loading={saving}
              >
                {editingId !== null
                  ? "Update"
                  : "Create"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Shop by Category panel */}
      {!showForm && (
        <Card
          className="mt-8 overflow-hidden"
          padding="none"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    Image
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Shop by Category
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Product by Category
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Slug
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {subcategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted"
                    >
                      No Shop by Category items found.
                    </td>
                  </tr>
                ) : (
                  subcategories.map((subcategory) => (
                    <tr
                      key={subcategory.id}
                      className="border-t border-border"
                    >
                      {/* Image */}
                      <td className="px-4 py-3">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                          {subcategory.image_url && (
                            <img
                              src={subcategory.image_url}
                              alt={subcategory.name}
                              className="h-full w-full object-contain p-1"
                            />
                          )}
                        </div>
                      </td>

                      {/* Subcategory */}
                      <td className="px-4 py-3 font-medium">
                        {subcategory.name}
                      </td>

                      {/* Main Category */}
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[#121358]/10 px-3 py-1 text-xs font-semibold text-[#121358]">
                          {subcategory.parent_id
                            ? mainCategoryMap.get(
                                subcategory.parent_id,
                              ) ?? "Unknown"
                            : "Not assigned"}
                        </span>
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3 text-muted">
                        {subcategory.slug}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(subcategory)
                            }
                            title="Edit"
                            aria-label={`Edit ${subcategory.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 hover:text-[#121358]"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-5 w-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 4 19.5l1.037-4.25L16.862 3.487Z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.5 5.5 18.5 9.5"
                              />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(
                                subcategory.id,
                              )
                            }
                            title="Delete"
                            aria-label={`Delete ${subcategory.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-5 w-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 7h12"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10 11v6M14 11v6"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 7V4h6v3"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 7l1 13h6l1-13"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}