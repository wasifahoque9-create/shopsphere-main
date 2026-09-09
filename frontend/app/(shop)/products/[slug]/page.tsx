"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useParams } from "next/navigation";

import { Swiper, SwiperSlide } from "swiper/react";
import {
  Autoplay,
  Navigation,
  Pagination,
} from "swiper/modules";

import {
  FaBoxOpen,
  FaCheckCircle,
  FaChevronRight,
  FaMinus,
  FaPlus,
  FaQuoteRight,
  FaShieldAlt,
  FaShoppingCart,
  FaStar,
  FaTruck,
  FaUserCircle,
} from "react-icons/fa";

import Button from "@/components/ui/Button";
import Card, {
  CardHeader,
} from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";

import {
  ApiError,
  cartApi,
  catalogApi,
  formatPrice,
  getProductImage,
  getProductPrice,
  getVariantLabel,
} from "@/lib/api";

import { useCart } from "@/lib/cart";

import type {
  Product,
  ProductVariant,
  Review,
} from "@/types";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const DEFAULT_REVIEW_IMAGE =
  "/Reviews/Review.jpeg";

type Notice = {
  type: "success" | "error";
  text: string;
};

type ExtendedReviewUser = {
  name?: string | null;
  image?: string | null;
  image_url?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  profile_image?: string | null;
  profile_image_url?: string | null;
};

type ExtendedReview = Review & {
  user?: ExtendedReviewUser | null;
};

/*
 * Summernote normally creates HTML such as:
 *
 * <ul>
 *   <li>Item one</li>
 *   <li>Item two</li>
 * </ul>
 *
 * or:
 *
 * <ol>
 *   <li>Item one</li>
 *   <li>Item two</li>
 * </ol>
 *
 * Tailwind CSS resets the browser's default list markers.
 * This function adds normal Tailwind classes to the generated
 * Summernote HTML.
 *
 * If Summernote has already saved an inline list style such as:
 *
 * <ul style="list-style-type: circle;">
 *
 * we do NOT remove it. The inline style can therefore keep
 * the style selected in Summernote.
 */
function prepareSummernoteHtml(
  html: string,
): string {
  let result = html;

  /*
   * Add Tailwind classes to <ul>.
   * If a class attribute already exists, append to it.
   */
  result = result.replace(
    /<ul\b([^>]*)>/gi,
    (_match, attributes: string) => {
      if (
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        )
      ) {
        return `<ul${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} list-disc pl-6 my-4${quote}`,
        )}>`;
      }

      return `<ul class="list-disc pl-6 my-4"${attributes}>`;
    },
  );

  /*
   * Add Tailwind classes to <ol>.
   */
  result = result.replace(
    /<ol\b([^>]*)>/gi,
    (_match, attributes: string) => {
      if (
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        )
      ) {
        return `<ol${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} list-decimal pl-6 my-4${quote}`,
        )}>`;
      }

      return `<ol class="list-decimal pl-6 my-4"${attributes}>`;
    },
  );

  /*
   * Add spacing to every list item.
   */
  result = result.replace(
    /<li\b([^>]*)>/gi,
    (_match, attributes: string) => {
      if (
        /\bclass\s*=\s*["'][^"']*["']/i.test(
          attributes,
        )
      ) {
        return `<li${attributes.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (
            _classMatch,
            quote: string,
            classNames: string,
          ) =>
            `class=${quote}${classNames} my-1${quote}`,
        )}>`;
      }

      return `<li class="my-1"${attributes}>`;
    },
  );

  return result;
}

function getErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (
    error &&
    typeof error === "object" &&
    "response" in error
  ) {
    const responseError = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
    };

    return (
      responseError.response?.data?.message ??
      fallback
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = (
      error as { message?: unknown }
    ).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function getReviewImage(review: Review) {
  const extendedReview =
    review as ExtendedReview;

  const user = extendedReview.user;

  return (
    user?.image_url?.trim() ||
    user?.avatar_url?.trim() ||
    user?.profile_image_url?.trim() ||
    user?.image?.trim() ||
    user?.avatar?.trim() ||
    user?.profile_image?.trim() ||
    DEFAULT_REVIEW_IMAGE
  );
}

type SafeProductImageProps = {
  src: string;
  alt: string;
  className?: string;
};

function SafeProductImage({
  src,
  alt,
  className = "",
}: SafeProductImageProps) {
  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <FaBoxOpen className="mx-auto text-6xl text-slate-300" />

          <p className="mt-3 text-sm font-medium text-slate-400">
            Product image unavailable
          </p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`h-full w-full ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

type ReviewAvatarProps = {
  image: string;
  name: string;
};

function ReviewAvatar({
  image,
  name,
}: ReviewAvatarProps) {
  const [imageSource, setImageSource] =
    useState(
      image?.trim() ||
        DEFAULT_REVIEW_IMAGE,
    );

  const [failed, setFailed] =
    useState(false);

  useEffect(() => {
    setImageSource(
      image?.trim() ||
        DEFAULT_REVIEW_IMAGE,
    );

    setFailed(false);
  }, [image]);

  function handleError() {
    if (
      imageSource !==
      DEFAULT_REVIEW_IMAGE
    ) {
      setImageSource(
        DEFAULT_REVIEW_IMAGE,
      );

      return;
    }

    setFailed(true);
  }

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
      {failed ? (
        <div className="flex h-full w-full items-center justify-center">
          <FaUserCircle className="text-5xl text-slate-400" />
        </div>
      ) : (
        <img
          src={imageSource}
          alt={`${name} profile`}
          className="h-full w-full object-cover"
          onError={handleError}
        />
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();

  const slug = Array.isArray(params.slug)
    ? params.slug[0]
    : String(params.slug ?? "");

  const { refreshCart } = useCart();

  const [product, setProduct] =
    useState<Product | null>(null);

  const [reviews, setReviews] =
    useState<Review[]>([]);

  const [
    selectedVariant,
    setSelectedVariant,
  ] =
    useState<ProductVariant | null>(
      null,
    );

  const [quantity, setQuantity] =
    useState(1);

  const [activeImage, setActiveImage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [adding, setAdding] =
    useState(false);

  const [
    submittingReview,
    setSubmittingReview,
  ] = useState(false);

  const [cartNotice, setCartNotice] =
    useState<Notice | null>(null);

  const [
    reviewNotice,
    setReviewNotice,
  ] = useState<Notice | null>(null);

  const [reviewForm, setReviewForm] =
    useState({
      rating: 5,
      comment: "",
    });

  useEffect(() => {
    let pageIsActive = true;

    async function loadProductPage() {
      try {
        setLoading(true);

        const [productData, reviewData] =
          await Promise.all([
            catalogApi.getProduct(slug),

            catalogApi
              .getProductReviews(slug)
              .catch(() => []),
          ]);

        if (!pageIsActive) return;

      setProduct(productData);
      setReviews(reviewData);

/*
 * The product-detail hero image should use
 * the optimized MAIN image, not the thumbnail.
 *
 * image.url = optimized main image (max 1600x1600)
 */
const primaryImage =
  productData.images?.find(
    (image) => image.is_primary,
  ) ??
  productData.images?.[0];

setActiveImage(
  primaryImage?.url ??
    getProductImage(productData),
);

if (
  productData.variants?.length
) {
  setSelectedVariant(
    productData.variants[0],
  );
}
      } catch (error) {
        console.error(
          "Unable to load product:",
          error,
        );

        if (pageIsActive) {
          setProduct(null);
        }
      } finally {
        if (pageIsActive) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      loadProductPage();
    }

    return () => {
      pageIsActive = false;
    };
  }, [slug]);

  async function refreshReviews() {
    try {
      const updatedReviews =
        await catalogApi.getProductReviews(
          slug,
        );

      setReviews(updatedReviews);
    } catch (error) {
      console.error(
        "Unable to refresh reviews:",
        error,
      );
    }
  }

  async function handleAddToCart() {
    if (!product) return;

    setAdding(true);
    setCartNotice(null);

    try {
      await cartApi.addItem({
        product_id: product.id,
        product_variant_id:
          selectedVariant?.id ?? null,
        quantity,
      });

      await refreshCart();

      setCartNotice({
        type: "success",
        text: `${quantity} item${
          quantity > 1 ? "s" : ""
        } added to your cart.`,
      });
    } catch (error) {
      console.error(
        "Add to cart error:",
        error,
      );

      setCartNotice({
        type: "error",
        text: getErrorMessage(
          error,
          "Failed to add item to cart. Please log in and try again.",
        ),
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleSubmitReview(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!product) return;

    const comment =
      reviewForm.comment.trim();

    if (!comment) {
      setReviewNotice({
        type: "error",
        text: "Please write your review before submitting.",
      });

      return;
    }

    setSubmittingReview(true);
    setReviewNotice(null);

    try {
      await catalogApi.createReview(
        product.id,
        {
          rating: reviewForm.rating,
          comment,
        },
      );

      setReviewForm({
        rating: 5,
        comment: "",
      });

      setReviewNotice({
        type: "success",
        text: "Your review was submitted successfully and may be waiting for approval.",
      });

      await refreshReviews();
    } catch (error) {
      console.error(
        "Review submission error:",
        error,
      );

      setReviewNotice({
        type: "error",
        text: getErrorMessage(
          error,
          "Failed to submit review. Make sure you are logged in and eligible to review this product.",
        ),
      });
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!product) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
          <FaBoxOpen className="mx-auto text-6xl text-slate-300" />

          <h1 className="mt-5 text-2xl font-black text-[#121358]">
            Product not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            The product may have been removed
            or the address may be incorrect.
          </p>

          <Link
            href="/products"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#c94b0b]"
          >
            Browse Products
            <FaChevronRight size={12} />
          </Link>
        </div>
      </main>
    );
  }

  const price = getProductPrice(
    product,
    selectedVariant,
  );

  const hasVariants =
    (product.variants?.length ?? 0) > 0;

  const availableStock = Number(
    hasVariants
      ? selectedVariant?.stock_qty ?? 0
      : product.stock_qty ?? 0,
  );

  const inStock =
    availableStock > 0;

  const images = product.images?.length
    ? product.images
    : [
        {
          id: 0,
          url: getProductImage(product),
          is_primary: true,
        },
      ];

  const averageRating = Number(
    product.average_rating ?? 0,
  );

  const reviewCount =
    product.review_count ??
    reviews.length;

  function decreaseQuantity() {
    setQuantity((current) =>
      Math.max(1, current - 1),
    );
  }

  function increaseQuantity() {
    setQuantity((current) =>
      Math.min(
        Math.max(availableStock, 1),
        current + 1,
      ),
    );
  }

  function selectVariant(
    variant: ProductVariant,
  ) {
    setSelectedVariant(variant);
    setQuantity(1);
    setCartNotice(null);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
           {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm text-slate-500 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="transition hover:text-[#EA580C]"
          >
            Home
          </Link>

          <FaChevronRight size={10} />

          <Link
            href="/products"
            className="transition hover:text-[#EA580C]"
          >
            Products
          </Link>

          {product.category?.name &&
            product.category?.slug && (
              <>
                <FaChevronRight size={10} />

                <Link
                  href={`/categories/${product.category.slug}`}
                  className="transition hover:text-[#EA580C]"
                >
                  {product.category.name}
                </Link>
              </>
            )}

          <FaChevronRight size={10} />

          <span className="max-w-[180px] truncate font-semibold text-[#121358] sm:max-w-md">
            {product.name}
          </span>
        </div>
      </div>

      {/* Product and purchase section */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Product gallery */}
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <div className="absolute left-4 top-4 z-10 sm:left-5 sm:top-5">
                {inStock ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <FaCheckCircle />
                    In Stock
                  </span>
                ) : (
                  <span className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">
                    Out of Stock
                  </span>
                )}
              </div>

              <div className="h-[360px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 sm:h-[420px] lg:h-[460px]">
                <SafeProductImage
                  src={
                    activeImage ||
                    getProductImage(product)
                  }
                  alt={product.name}
                  className="object-contain p-3 transition duration-500 hover:scale-105 sm:p-6"
                />
              </div>
            </div>

            {images.length > 1 && (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
               {images.map((image) => {
  /*
   * Small gallery buttons should use the
   * optimized thumbnail image.
   *
   * thumbnail_url = max 500x500
   */
  const source =
    image.thumbnail_url ||
    image.url ||
    getProductImage({
      ...product,
      images: [image],
    });

  const selected =
    activeImage === source;

                  return (
                    <button
                      key={image.id}
                      type="button"
                      aria-label={`View another image of ${product.name}`}
                      onClick={() =>
  setActiveImage(
    image.url ||
      image.thumbnail_url ||
      getProductImage({
        ...product,
        images: [image],
      }),
  )
}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1.5 transition ${
                        selected
                          ? "border-[#EA580C] shadow-md"
                          : "border-slate-200 hover:border-[#121358]/40"
                      }`}
                    >
                      <SafeProductImage
                        src={source}
                        alt=""
                        className="object-contain"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unique purchase card */}
          <div className="h-fit rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && (
                <span className="rounded-full bg-[#121358]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#121358]">
                  {product.brand}
                </span>
              )}

              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  inStock
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {inStock
                  ? `${availableStock} available`
                  : "Currently unavailable"}
              </span>
            </div>

            <h1 className="mt-5 text-3xl font-black leading-tight text-[#121358] sm:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-yellow-400">
                {[1, 2, 3, 4, 5].map(
                  (star) => (
                    <FaStar
                      key={star}
                      className={
                        star <=
                        Math.round(
                          averageRating,
                        )
                          ? "text-yellow-400"
                          : "text-slate-200"
                      }
                    />
                  ),
                )}
              </div>

              <span className="text-sm font-semibold text-slate-600">
                {averageRating.toFixed(1)}
              </span>

              <span className="text-sm text-slate-400">
                ({reviewCount}{" "}
                {reviewCount === 1
                  ? "review"
                  : "reviews"}
                )
              </span>
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#121358] to-[#292b79] p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                Current price
              </p>

              <p className="mt-2 text-3xl font-black text-[#F59E0B] sm:text-4xl">
                {formatPrice(price)}
              </p>

              <p className="mt-2 text-xs text-white/60">
                Price may change depending on
                your selected variant.
              </p>
            </div>

            {/* Summernote HTML description */}
            {product.description && (
              <div
                className="mt-6 max-w-none text-sm leading-6 text-slate-600"
                dangerouslySetInnerHTML={{
                  __html: prepareSummernoteHtml(
                    product.description,
                  ),
                }}
              />
            )}

            {hasVariants && (
              <div className="mt-7">
                <label className="mb-3 block text-sm font-bold text-[#121358]">
                  Choose a variant
                </label>

                <div className="flex flex-wrap gap-2.5">
                  {product.variants!.map(
                    (variant) => {
                      const active =
                        selectedVariant?.id ===
                        variant.id;

                      const variantStock =
                        Number(
                          variant.stock_qty ??
                            0,
                        );

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() =>
                            selectVariant(
                              variant,
                            )
                          }
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active
                              ? "border-[#121358] bg-[#121358] text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#EA580C]"
                          }`}
                        >
                          <span className="block font-bold">
                            {getVariantLabel(
                              variant,
                            )}
                          </span>

                          <span
                            className={`mt-1 block text-xs ${
                              active
                                ? "text-white/70"
                                : "text-slate-400"
                            }`}
                          >
                            {formatPrice(
                              getProductPrice(
                                product,
                                variant,
                              ),
                            )}
                            {" · "}
                            {variantStock} in
                            stock
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            <div className="mt-7">
              <label className="mb-3 block text-sm font-bold text-[#121358]">
                Select quantity
              </label>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={decreaseQuantity}
                    disabled={quantity <= 1}
                    className="flex h-12 w-12 items-center justify-center text-[#121358] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <FaMinus size={12} />
                  </button>

                  <span className="flex h-12 min-w-14 items-center justify-center border-x border-slate-200 bg-white text-base font-black text-[#121358]">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={increaseQuantity}
                    disabled={
                      !inStock ||
                      quantity >=
                        availableStock
                    }
                    className="flex h-12 w-12 items-center justify-center text-[#121358] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <FaPlus size={12} />
                  </button>
                </div>

                <p className="text-sm text-slate-500">
                  {inStock
                    ? `${availableStock} items currently in stock`
                    : "This product is out of stock"}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="mt-7 flex w-full items-center justify-center gap-2 bg-[#F59E0B] py-4 font-bold text-white hover:bg-[#d9890a]"
              onClick={handleAddToCart}
              loading={adding}
              disabled={!inStock}
            >
              <FaShoppingCart />
              Add to Cart
            </Button>

            {cartNotice && (
              <div
                role="alert"
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                  cartNotice.type ===
                  "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {cartNotice.text}
              </div>
            )}

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <PurchaseBenefit
                icon={<FaTruck />}
                title="Fast delivery"
                text="Careful shipping"
              />

              <PurchaseBenefit
                icon={<FaShieldAlt />}
                title="Secure order"
                text="Protected checkout"
              />

              <PurchaseBenefit
                icon={<FaCheckCircle />}
                title="Quality checked"
                text="Trusted products"
              />
            </div>
          </div>
        </div>

        {product.specifications &&
          Object.keys(
            product.specifications,
          ).length > 0 && (
            <Card
              className="mt-10 overflow-hidden rounded-3xl border-slate-200"
              padding="md"
            >
              <CardHeader title="Product Specifications" />

              <dl className="divide-y divide-slate-200">
                {Object.entries(
                  product.specifications,
                ).map(([key, value]) => (
                  <div
                    key={key}
                    className="grid gap-2 py-3 text-sm sm:grid-cols-2"
                  >
                    <dt className="font-semibold capitalize text-slate-500">
                      {key.replace(
                        /_/g,
                        " ",
                      )}
                    </dt>

                    <dd className="font-medium text-[#121358] sm:text-right">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
      </section>

      {/* Review section */}
      <section className="border-t border-slate-200 bg-[#F3F4F4] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#EA580C]">
              Real customer feedback
            </p>

            <h2 className="mt-2 text-3xl font-black text-[#121358] sm:text-4xl">
              Customer Reviews
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Read verified feedback or
              share your own experience with
              this product.
            </p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-[380px_1fr]">
            {/* Review form */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EA580C]/10 text-[#EA580C]">
                  <FaQuoteRight />
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#121358]">
                    Write a Review
                  </h3>

                  <p className="text-xs text-slate-500">
                    Tell others what you
                    think.
                  </p>
                </div>
              </div>

              <form
                onSubmit={
                  handleSubmitReview
                }
                className="mt-7 space-y-5"
              >
                <div>
                  <label className="mb-3 block text-sm font-bold text-[#121358]">
                    Your rating
                  </label>

                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(
                      (rating) => (
                        <button
                          key={rating}
                          type="button"
                          aria-label={`Give ${rating} stars`}
                          onClick={() =>
                            setReviewForm(
                              (current) => ({
                                ...current,
                                rating,
                              }),
                            )
                          }
                          className="rounded-lg p-1 transition hover:scale-110"
                        >
                          <FaStar
                            size={25}
                            className={
                              rating <=
                              reviewForm.rating
                                ? "text-yellow-400"
                                : "text-slate-200"
                            }
                          />
                        </button>
                      ),
                    )}
                  </div>

                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {reviewForm.rating} out
                    of 5 stars
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="review-comment"
                    className="mb-2 block text-sm font-bold text-[#121358]"
                  >
                    Your comment
                  </label>

                  <textarea
                    id="review-comment"
                    required
                    rows={6}
                    value={
                      reviewForm.comment
                    }
                    onChange={(event) =>
                      setReviewForm(
                        (current) => ({
                          ...current,
                          comment:
                            event.target
                              .value,
                        }),
                      )
                    }
                    placeholder="Share your experience with this product..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#EA580C] focus:bg-white focus:ring-4 focus:ring-[#EA580C]/10"
                  />
                </div>

                <Button
                  type="submit"
                  loading={
                    submittingReview
                  }
                  className="w-full bg-[#121358] py-3 font-bold text-white hover:bg-[#292b79]"
                >
                  Submit Review
                </Button>

                {reviewNotice && (
                  <div
                    role="alert"
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      reviewNotice.type ===
                      "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {reviewNotice.text}
                  </div>
                )}

                <p className="text-center text-xs leading-5 text-slate-400">
                  Reviews may require
                  approval before appearing
                  publicly.
                </p>
              </form>
            </div>

            {/* Backend review slider */}
            <div className="min-w-0">
              {reviews.length === 0 ? (
                <DefaultReviewCard />
              ) : (
                <Swiper
                  modules={[
                    Pagination,
                    Navigation,
                    Autoplay,
                  ]}
                  spaceBetween={22}
                  loop={
                    reviews.length > 2
                  }
                  speed={800}
                  autoplay={
                    reviews.length > 1
                      ? {
                          delay: 3500,
                          disableOnInteraction:
                            false,
                          pauseOnMouseEnter:
                            true,
                        }
                      : false
                  }
                  navigation={
                    reviews.length > 1
                  }
                  pagination={{
                    clickable: true,
                  }}
                  breakpoints={{
                    0: {
                      slidesPerView: 1,
                    },
                    768: {
                      slidesPerView: 2,
                    },
                  }}
                  className="product-review-swiper !pb-14"
                >
                  {reviews.map(
                    (review) => {
                      const reviewerName =
                        review.user
                          ?.name ||
                        "Customer";

                      return (
                        <SwiperSlide
                          key={review.id}
                          className="!h-auto py-2"
                        >
                          <article className="group relative flex h-full min-h-[330px] flex-col items-center overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 pb-7 pt-9 text-center shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                            <div className="absolute left-6 right-6 top-0 h-1 rounded-b-full bg-[#EA580C]" />

                            <FaQuoteRight className="absolute right-6 top-7 text-3xl text-[#121358]/5" />

                            <ReviewAvatar
                              image={getReviewImage(
                                review,
                              )}
                              name={
                                reviewerName
                              }
                            />

                            <div className="-mt-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#121358] text-white shadow-md">
                              <FaQuoteRight size={11} />
                            </div>

                            <div className="mt-5 flex gap-1">
                              {[
                                1,
                                2,
                                3,
                                4,
                                5,
                              ].map(
                                (star) => (
                                  <FaStar
                                    key={star}
                                    size={15}
                                    className={
                                      star <=
                                      Number(
                                        review.rating,
                                      )
                                        ? "text-yellow-400"
                                        : "text-slate-200"
                                    }
                                  />
                                ),
                              )}
                            </div>

                            <p className="mt-5 flex-1 text-sm leading-7 text-slate-500">
                              “
                              {
                                review.comment
                              }
                              ”
                            </p>

                            <div className="mt-6">
                              <p className="flex items-center justify-center gap-1.5 font-bold text-[#121358]">
                                {
                                  reviewerName
                                }

                                <FaCheckCircle
                                  size={13}
                                  className="text-[#EA580C]"
                                />
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Verified Customer
                              </p>

                              {review.status && (
                                <div className="mt-3">
                                  <Badge
                                    variant={
                                      review.status ===
                                      "approved"
                                        ? "success"
                                        : "warning"
                                    }
                                  >
                                    {
                                      review.status
                                    }
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </article>
                        </SwiperSlide>
                      );
                    },
                  )}
                </Swiper>
              )}
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .product-review-swiper
          .swiper-pagination-bullet {
          width: 8px;
          height: 8px;
          background: #121358;
          opacity: 0.25;
          transition: all 0.25s ease;
        }

        .product-review-swiper
          .swiper-pagination-bullet-active {
          width: 22px;
          border-radius: 999px;
          background: #ea580c;
          opacity: 1;
        }

        .product-review-swiper
          .swiper-button-next,
        .product-review-swiper
          .swiper-button-prev {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          background: #ffffff;
          color: #121358;
          box-shadow: 0 4px 16px
            rgba(15, 23, 42, 0.15);
          transition: all 0.25s ease;
        }

        .product-review-swiper
          .swiper-button-next::after,
        .product-review-swiper
          .swiper-button-prev::after {
          font-size: 15px;
          font-weight: 900;
        }

        .product-review-swiper
          .swiper-button-next:hover,
        .product-review-swiper
          .swiper-button-prev:hover {
          background: #ea580c;
          color: #ffffff;
        }

        @media (max-width: 640px) {
          .product-review-swiper
            .swiper-button-next,
          .product-review-swiper
            .swiper-button-prev {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}

type PurchaseBenefitProps = {
  icon: ReactNode;
  title: string;
  text: string;
};

function PurchaseBenefit({
  icon,
  title,
  text,
}: PurchaseBenefitProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#EA580C]/10 text-[#EA580C]">
        {icon}
      </span>

      <p className="mt-2 text-xs font-bold text-[#121358]">
        {title}
      </p>

      <p className="mt-1 text-[10px] text-slate-400">
        {text}
      </p>
    </div>
  );
}

function DefaultReviewCard() {
  return (
    <div className="flex min-h-[390px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <article className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white px-7 pb-8 pt-10 text-center shadow-md">
        <div className="absolute left-6 right-6 top-0 h-1 rounded-b-full bg-[#EA580C]" />

        <ReviewAvatar
          image={DEFAULT_REVIEW_IMAGE}
          name="ShopSphere Customer"
        />

        <div className="-mt-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#121358] text-white shadow-md">
          <FaQuoteRight size={11} />
        </div>

        <div className="mt-5 flex justify-center gap-1 text-yellow-400">
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <FaStar
                key={star}
                size={15}
              />
            ),
          )}
        </div>

        <h3 className="mt-5 text-lg font-black text-[#121358]">
          Be the first to review
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          No customer reviews are available
          yet. Submit your experience using
          the review form.
        </p>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-sm font-bold text-[#121358]">
          ShopSphere Customer
          <FaCheckCircle
            size={13}
            className="text-[#EA580C]"
          />
        </p>
      </article>
    </div>
  );
}