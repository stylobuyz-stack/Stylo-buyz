# STYLO BUYZ — Full Ecommerce Starter

## What is included
- Customer storefront
- Men, Women, T-Shirts, Bottoms and **Accessories** categories
- Shopping cart
- Customer details at checkout: name, phone, email, address, city, state and pincode
- COD
- Razorpay online checkout integration
- Server-side Razorpay order creation
- Payment signature verification
- Webhook endpoint
- Admin panel at `/admin`
- Add/delete products from admin panel
- Order list in admin panel
- Products and orders stored in JSON files for this starter

## Run
1. Install Node.js 18+.
2. Copy `.env.example` to `.env`.
3. Set a strong `ADMIN_PASSWORD`.
4. For online payments, create a Razorpay account and add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
5. Run:
   npm install
   npm start
6. Open http://localhost:3000
7. Admin: http://localhost:3000/admin

## Razorpay
The site creates Razorpay orders on the server, then opens Checkout in the browser and verifies the payment signature on the server. Keep the Razorpay secret only on the server; never put it in frontend JavaScript.

## Before going live
- Use HTTPS.
- Replace JSON storage with a real database (PostgreSQL/MySQL/Supabase etc.) for a production store.
- Add proper admin authentication/roles.
- Add image upload/storage.
- Configure shipping/tax/GST/returns/privacy pages.
- Configure Razorpay webhook in Dashboard to:
  https://YOUR-DOMAIN.com/api/razorpay-webhook
- Test in Razorpay test mode first, then switch to live keys.
