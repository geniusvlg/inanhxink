package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	adminHandlers "inanhxink/backend-golang/internal/handlers/admin"
	"inanhxink/backend-golang/internal/middleware"
	"inanhxink/backend-golang/internal/sentrylog"
)

func main() {
	// Load .env from common launch locations. godotenv resolves paths from the
	// current working directory, not the compiled binary location.
	godotenv.Load(".env", "backend-golang/.env", "../../.env") //nolint — optional; env vars may be set externally

	sentrylog.Init(os.Getenv("SENTRY_DSN"), os.Getenv("APP_ENV"), os.Getenv("APP_VERSION"))
	defer sentrylog.Flush()

	// Initialise shared resources
	config.InitDB()
	config.InitS3()
	config.InitCDN()
	adminHandlers.FailInterruptedProductVideoJobs()

	// Background cleanup: evict expired QR name reservations every 5 minutes.
	go func() {
		for range time.NewTicker(5 * time.Minute).C {
			handlers.PruneExpiredReservations()
		}
	}()

	r := chi.NewRouter()

	// ── Global middleware ───────────────────────────────────────────────────
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}))
	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// ── Static files ────────────────────────────────────────────────────────
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("public/uploads"))))
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("public"))))
	r.Handle("/templates/*", http.StripPrefix("/templates/", http.FileServer(http.Dir("public/templates"))))

	// ── Health / DB check ───────────────────────────────────────────────────
	r.Get("/api/health", handlers.Health)
	r.Get("/api/test-db", handlers.TestDB)

	// ── File upload ─────────────────────────────────────────────────────────
	r.Post("/api/upload", handlers.Upload)
	r.Post("/api/upload/voice", handlers.UploadVoiceRecording)
	r.Post("/api/upload/qr/presign", handlers.SignQRUpload)

	// ── Site data (subdomain routing) ───────────────────────────────────────
	r.Get("/api/site-data", handlers.SiteData)

	// ── Public API routes ───────────────────────────────────────────────────
	r.Route("/api/templates", func(r chi.Router) {
		r.Get("/", handlers.ListTemplates)
		r.Get("/{id}", handlers.GetTemplate)
	})

	r.Route("/api/vouchers", func(r chi.Router) {
		r.Post("/validate", handlers.ValidateVoucher)
	})

	r.Route("/api/orders", func(r chi.Router) {
		r.Post("/check-qr-name", handlers.CheckQRName)
		r.Post("/", handlers.CreateOrder)
		r.Get("/{id}", handlers.GetOrder)
		r.Get("/track", handlers.TrackOrder)
		r.Get("/spx-tracking", handlers.SpxTracking)
	})

	r.Route("/api/qrcodes", func(r chi.Router) {
		r.Get("/{qrName}", handlers.GetQRCode)
	})

	r.Route("/api/payments", func(r chi.Router) {
		r.Post("/", handlers.CreatePayment)
		r.Post("/checkout", handlers.CreateCheckout)
		r.Post("/product-checkout", handlers.CreateProductCheckout)
		r.Post("/webhook/qr", handlers.QRPaymentWebhook)
		r.Post("/webhook/product", handlers.ProductPaymentWebhook)
		r.Post("/webhook/pay2s", handlers.Pay2SWebhookLogger)
		r.Get("/order/{orderId}", handlers.GetPaymentByOrder)
		r.Get("/product/{orderId}", handlers.GetProductPayment)
		r.Get("/qr/{qrName}", handlers.GetPaymentByQR)
	})

	r.Route("/api/product-orders", func(r chi.Router) {
		r.Post("/", handlers.CreateProductOrder)
		r.Get("/{id}", handlers.GetProductOrder)
	})

	r.Route("/api/music", func(r chi.Router) {
		r.Post("/extract", handlers.ExtractMusic)
	})

	r.Route("/api/metadata", func(r chi.Router) {
		r.Get("/", handlers.GetMetadata)
	})

	r.Route("/api/products", func(r chi.Router) {
		r.Get("/featured-on-home", handlers.ListFeaturedProducts)
		r.Get("/", handlers.ListProducts)
		r.Get("/{id}/reviews", handlers.ListProductReviews)
		r.Post("/{id}/reviews", handlers.CreateProductReview)
		r.Get("/{id}", handlers.GetProduct)
	})

	r.Route("/api/testimonials", func(r chi.Router) {
		r.Get("/", handlers.ListTestimonials)
	})

	r.Route("/api/banners", func(r chi.Router) {
		r.Get("/", handlers.ListBanners)
	})

	r.Route("/api/hero-shots", func(r chi.Router) {
		r.Get("/", handlers.ListHeroShots)
	})

	r.Route("/api/categories", func(r chi.Router) {
		r.Get("/", handlers.ListCategories)
		r.Get("/{id}", handlers.GetCategory)
	})

	// ── Admin API routes (JWT-protected) ────────────────────────────────────
	r.Route("/api/admin", func(r chi.Router) {
		// Auth (unauthenticated)
		r.Post("/auth/login", adminHandlers.Login)
		r.Get("/auth/me", middleware.RequireAdmin(http.HandlerFunc(adminHandlers.Me)).ServeHTTP)
		r.Put("/auth/profile", middleware.RequireAdmin(http.HandlerFunc(adminHandlers.UpdateProfile)).ServeHTTP)
		r.Post("/auth/password", middleware.RequireAdmin(http.HandlerFunc(adminHandlers.ChangePassword)).ServeHTTP)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin)

			r.Route("/roles", func(r chi.Router) {
				r.Use(middleware.RequireSystemAdmin)
				r.Get("/catalog", adminHandlers.RoleCatalog)
				r.Get("/", adminHandlers.ListRoles)
				r.Post("/", adminHandlers.CreateRole)
				r.Put("/{id}", adminHandlers.UpdateRole)
				r.Delete("/{id}", adminHandlers.DeleteRole)
			})

			r.Route("/users", func(r chi.Router) {
				r.Use(middleware.RequireSystemAdmin)
				r.Get("/", adminHandlers.ListUsers)
				r.Post("/", adminHandlers.CreateUser)
				r.Put("/{id}", adminHandlers.UpdateUser)
				r.Post("/{id}/password", adminHandlers.ResetUserPassword)
			})

			r.Route("/templates", func(r chi.Router) {
				r.With(middleware.RequirePermission("qr_templates.view")).Get("/", adminHandlers.ListTemplates)
				r.With(middleware.RequirePermission("qr_templates.view")).Get("/{id}", adminHandlers.GetTemplate)
				r.With(middleware.RequirePermission("qr_templates.create")).Post("/", adminHandlers.CreateTemplate)
				r.With(middleware.RequirePermission("qr_templates.update")).Put("/{id}", adminHandlers.UpdateTemplate)
				r.With(middleware.RequirePermission("qr_templates.delete")).Delete("/{id}", adminHandlers.DeleteTemplate)
			})

			r.Route("/orders", func(r chi.Router) {
				r.With(middleware.RequirePermission("qr_orders.view")).Get("/", adminHandlers.ListOrders)
				r.With(middleware.RequirePermission("qr_orders.view")).Get("/search", adminHandlers.SearchOrder)
				r.With(middleware.RequirePermission("qr_orders.view")).Get("/{id}", adminHandlers.GetOrder)
				r.With(middleware.RequirePermission("qr_orders.update")).Patch("/{id}/status", adminHandlers.UpdateOrderStatus)
				r.With(middleware.RequirePermission("fulfillment.update")).Patch("/{id}/fulfillment", adminHandlers.UpdateQRKeychainFulfillment)
			})

			r.With(middleware.RequirePermission("qr_orders.update")).Delete("/qr-names/{qrName}", adminHandlers.ReleaseQRName)
			r.With(middleware.RequirePermission("qr_orders.update")).Patch("/qr-names/{qrName}/volume", adminHandlers.UpdateQRMusicVolume)

			r.Route("/product-orders", func(r chi.Router) {
				r.With(middleware.RequirePermission("product_orders.view")).Get("/", adminHandlers.ListProductOrders)
				r.With(middleware.RequirePermission("fulfillment.view")).Get("/fulfillment", adminHandlers.ListFulfillmentOrders)
				r.With(middleware.RequirePermission("product_orders.view", "fulfillment.view")).Get("/{id}", adminHandlers.GetProductOrder)
				r.With(middleware.RequirePermission("product_orders.update")).Patch("/{id}/status", adminHandlers.UpdateProductOrderStatus)
				r.With(middleware.RequirePermission("fulfillment.update")).Patch("/{id}/fulfillment", adminHandlers.UpdateFulfillmentStatus)
				r.With(middleware.RequirePermission("fulfillment.update")).Patch("/{id}/items", adminHandlers.UpdateProductOrderItems)
			})

			r.Route("/vouchers", func(r chi.Router) {
				r.With(middleware.RequirePermission("vouchers.view")).Get("/", adminHandlers.ListVouchers)
				r.With(middleware.RequirePermission("vouchers.create")).Post("/", adminHandlers.CreateVoucher)
				r.With(middleware.RequirePermission("vouchers.update")).Put("/{id}", adminHandlers.UpdateVoucher)
				r.With(middleware.RequirePermission("vouchers.delete")).Delete("/{id}", adminHandlers.DeleteVoucher)
			})

			r.Route("/metadata", func(r chi.Router) {
				r.With(middleware.RequirePermission("config.view", "in_anh.view", "banners.view")).Get("/", adminHandlers.GetMetadata)
				r.With(middleware.RequirePermission("config.update", "in_anh.update", "banners.update")).Put("/", adminHandlers.UpsertMetadata)
			})

			r.Route("/products", func(r chi.Router) {
				r.With(middleware.RequirePermission("featured.view")).Get("/featured-on-home", adminHandlers.ListFeaturedProducts)
				r.With(middleware.RequirePermission("featured.update")).Patch("/featured-on-home/reorder", adminHandlers.ReorderFeaturedProducts)
				r.Get("/", adminHandlers.ListProducts)
				r.Post("/check-name", adminHandlers.CheckProductName)
				r.Post("/reserve", adminHandlers.ReserveProduct)
				r.Post("/", adminHandlers.CreateProduct)
				r.Post("/{id}/video/presign", adminHandlers.PresignProductVideo)
				r.Post("/{id}/video/jobs/{jobId}/process", adminHandlers.StartProductVideoJob)
				r.Get("/{id}/video/jobs/{jobId}", adminHandlers.GetProductVideoJob)
				r.Post("/{id}/video/jobs/{jobId}/commit", adminHandlers.CommitProductVideoJob)
				r.Post("/{id}/video/jobs/{jobId}/cancel", adminHandlers.CancelProductVideoJob)
				r.Get("/{id}/video/job", adminHandlers.LatestProductVideoJob)
				r.With(middleware.RequirePermission("product_reviews.view")).Get("/{id}/reviews", adminHandlers.ListAdminProductReviews)
				r.With(middleware.RequirePermission("product_reviews.create")).Post("/{id}/reviews", adminHandlers.CreateAdminProductReview)
				r.With(middleware.RequirePermission("product_reviews.delete")).Delete("/{id}/reviews/{reviewId}", adminHandlers.DeleteAdminProductReview)
				r.Get("/{id}", adminHandlers.GetProduct)
				r.Put("/{id}", adminHandlers.UpdateProduct)
				r.Delete("/{id}", adminHandlers.DeleteProduct)
				r.Get("/{id}/variants", adminHandlers.ListProductVariants)
				r.Put("/{id}/variants", adminHandlers.UpsertProductVariants)
				r.Delete("/{id}/variants/{variantId}", adminHandlers.DeleteProductVariant)
			})

			r.Route("/product-categories", func(r chi.Router) {
				r.With(middleware.RequirePermission("categories.view")).Get("/", adminHandlers.ListProductCategories)
				r.With(middleware.RequirePermission("categories.create")).Post("/", adminHandlers.CreateProductCategory)
				r.With(middleware.RequirePermission("categories.update")).Put("/{id}", adminHandlers.UpdateProductCategory)
				r.With(middleware.RequirePermission("categories.delete")).Delete("/{id}", adminHandlers.DeleteProductCategory)
			})

			r.Route("/testimonials", func(r chi.Router) {
				r.With(middleware.RequirePermission("testimonials.view")).Get("/", adminHandlers.ListTestimonials)
				r.With(middleware.RequirePermission("testimonials.create")).Post("/", adminHandlers.CreateTestimonial)
				r.With(middleware.RequirePermission("testimonials.create")).Post("/bulk", adminHandlers.BulkCreateTestimonials)
				r.With(middleware.RequirePermission("testimonials.update")).Patch("/reorder", adminHandlers.ReorderTestimonials)
				r.With(middleware.RequirePermission("testimonials.update")).Put("/{id}", adminHandlers.UpdateTestimonial)
				r.With(middleware.RequirePermission("testimonials.delete")).Delete("/{id}", adminHandlers.DeleteTestimonial)
			})

			r.Route("/banners", func(r chi.Router) {
				r.With(middleware.RequirePermission("banners.view")).Get("/", adminHandlers.ListBanners)
				r.With(middleware.RequirePermission("banners.create")).Post("/", adminHandlers.CreateBanner)
				r.With(middleware.RequirePermission("banners.update")).Patch("/reorder", adminHandlers.ReorderBanners)
				r.With(middleware.RequirePermission("banners.update")).Put("/{id}", adminHandlers.UpdateBanner)
				r.With(middleware.RequirePermission("banners.delete")).Delete("/{id}", adminHandlers.DeleteBanner)
			})

			r.Route("/hero-shots", func(r chi.Router) {
				r.With(middleware.RequirePermission("hero_shots.view")).Get("/", adminHandlers.ListHeroShots)
				r.With(middleware.RequirePermission("hero_shots.update")).Put("/{slot}", adminHandlers.UpdateHeroShot)
			})

			r.Delete("/uploads", adminHandlers.DeleteUploads)
		})
	})

	// ── Catch-all: serve template HTML for subdomains ────────────────────────
	r.NotFound(handlers.ServeTemplate)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	domain := os.Getenv("DOMAIN")
	if domain == "" {
		domain = "inanhxink.com"
	}

	log.Printf("Server running on http://localhost:%s", port)
	log.Printf("Domain: %s", domain)
	log.Printf("Template preview (local): http://localhost:%s/?preview=<qrName>", port)
	fmt.Printf("Server running on http://localhost:%s\n", port)

	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
