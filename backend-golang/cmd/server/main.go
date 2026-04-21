package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	adminHandlers "inanhxink/backend-golang/internal/handlers/admin"
	"inanhxink/backend-golang/internal/middleware"
)

func main() {
	// Load .env (same directory as the binary, or project root)
	godotenv.Load("../../.env") //nolint — optional; env vars may be set externally

	// Initialise shared resources
	config.InitDB()
	config.InitS3()
	config.InitCDN()

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
	})

	r.Route("/api/qrcodes", func(r chi.Router) {
		r.Get("/{qrName}", handlers.GetQRCode)
	})

	r.Route("/api/payments", func(r chi.Router) {
		r.Post("/", handlers.CreatePayment)
		r.Post("/webhook", handlers.PaymentWebhook)
		r.Get("/order/{orderId}", handlers.GetPaymentByOrder)
		r.Get("/qr/{qrName}", handlers.GetPaymentByQR)
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
	})

	// ── Admin API routes (JWT-protected) ────────────────────────────────────
	r.Route("/api/admin", func(r chi.Router) {
		// Auth (unauthenticated)
		r.Post("/auth/login", adminHandlers.Login)
		r.Get("/auth/me", middleware.RequireAdmin(http.HandlerFunc(adminHandlers.Me)).ServeHTTP)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAdmin)

			r.Route("/templates", func(r chi.Router) {
				r.Get("/", adminHandlers.ListTemplates)
				r.Get("/{id}", adminHandlers.GetTemplate)
				r.Post("/", adminHandlers.CreateTemplate)
				r.Put("/{id}", adminHandlers.UpdateTemplate)
				r.Delete("/{id}", adminHandlers.DeleteTemplate)
			})

			r.Route("/orders", func(r chi.Router) {
				r.Get("/", adminHandlers.ListOrders)
				r.Get("/{id}", adminHandlers.GetOrder)
				r.Patch("/{id}/status", adminHandlers.UpdateOrderStatus)
			})

			r.Route("/vouchers", func(r chi.Router) {
				r.Get("/", adminHandlers.ListVouchers)
				r.Post("/", adminHandlers.CreateVoucher)
				r.Put("/{id}", adminHandlers.UpdateVoucher)
				r.Delete("/{id}", adminHandlers.DeleteVoucher)
			})

			r.Route("/metadata", func(r chi.Router) {
				r.Get("/", adminHandlers.GetMetadata)
				r.Put("/", adminHandlers.UpsertMetadata)
			})

			r.Route("/products", func(r chi.Router) {
				r.Get("/featured-on-home", adminHandlers.ListFeaturedProducts)
				r.Patch("/featured-on-home/reorder", adminHandlers.ReorderFeaturedProducts)
				r.Get("/", adminHandlers.ListProducts)
				r.Post("/check-name", adminHandlers.CheckProductName)
				r.Post("/reserve", adminHandlers.ReserveProduct)
				r.Post("/", adminHandlers.CreateProduct)
				r.Get("/{id}", adminHandlers.GetProduct)
				r.Put("/{id}", adminHandlers.UpdateProduct)
				r.Delete("/{id}", adminHandlers.DeleteProduct)
			})

			r.Route("/product-categories", func(r chi.Router) {
				r.Get("/", adminHandlers.ListProductCategories)
				r.Post("/", adminHandlers.CreateProductCategory)
				r.Delete("/{id}", adminHandlers.DeleteProductCategory)
			})

			r.Route("/testimonials", func(r chi.Router) {
				r.Get("/", adminHandlers.ListTestimonials)
				r.Post("/", adminHandlers.CreateTestimonial)
				r.Post("/bulk", adminHandlers.BulkCreateTestimonials)
				r.Patch("/reorder", adminHandlers.ReorderTestimonials)
				r.Put("/{id}", adminHandlers.UpdateTestimonial)
				r.Delete("/{id}", adminHandlers.DeleteTestimonial)
			})

			r.Route("/banners", func(r chi.Router) {
				r.Get("/", adminHandlers.ListBanners)
				r.Post("/", adminHandlers.CreateBanner)
				r.Patch("/reorder", adminHandlers.ReorderBanners)
				r.Put("/{id}", adminHandlers.UpdateBanner)
				r.Delete("/{id}", adminHandlers.DeleteBanner)
			})

			r.Route("/hero-shots", func(r chi.Router) {
				r.Get("/", adminHandlers.ListHeroShots)
				r.Put("/{slot}", adminHandlers.UpdateHeroShot)
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
