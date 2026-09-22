require("dotenv").config();
const express=require("express"), fs=require("fs"), path=require("path"), crypto=require("crypto");
const Razorpay=require("razorpay");
const app=express(), PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,"products.json"), ORDERS=path.join(__dirname,"orders.json");
function readJSON(f, fallback=[]){try{return JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){return fallback}}
function writeJSON(f,d){fs.writeFileSync(f,JSON.stringify(d,null,2))}
function auth(req,res,next){
  const key=req.headers["x-admin-password"];
  if(!process.env.ADMIN_PASSWORD || key!==process.env.ADMIN_PASSWORD)return res.status(401).json({error:"Unauthorized"});
  next();
}
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

app.get("/api/products",(req,res)=>res.json(readJSON(DATA)));
app.post("/api/admin/products",auth,(req,res)=>{
  const p=readJSON(DATA); const body=req.body;
  if(!body.name||!body.price||!body.category)return res.status(400).json({error:"Name, price and category are required"});
  const item={id:"p"+Date.now(),name:String(body.name),price:Number(body.price),category:String(body.category),gender:String(body.gender||"Unisex"),sizes:Array.isArray(body.sizes)?body.sizes:[],stock:Number(body.stock||0),image:String(body.image||""),description:String(body.description||"")};
  p.push(item);writeJSON(DATA,p);res.json(item);
});
app.put("/api/admin/products/:id",auth,(req,res)=>{
  const p=readJSON(DATA), i=p.findIndex(x=>x.id===req.params.id);
  if(i<0)return res.status(404).json({error:"Not found"});
  p[i]={...p[i],...req.body,id:p[i].id,price:Number(req.body.price??p[i].price),stock:Number(req.body.stock??p[i].stock)};
  writeJSON(DATA,p);res.json(p[i]);
});
app.delete("/api/admin/products/:id",auth,(req,res)=>{
  const p=readJSON(DATA).filter(x=>x.id!==req.params.id);writeJSON(DATA,p);res.json({ok:true});
});
app.get("/api/admin/orders",auth,(req,res)=>res.json(readJSON(ORDERS)));
app.patch("/api/admin/orders/:id",auth,(req,res)=>{
  const o=readJSON(ORDERS),i=o.findIndex(x=>x.id===req.params.id);
  if(i<0)return res.status(404).json({error:"Not found"});
  o[i].status=String(req.body.status||o[i].status);writeJSON(ORDERS,o);res.json(o[i]);
});

function razor(){
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)return null;
  return new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
}
app.post("/api/create-order",async(req,res)=>{
  try{
    const {items,customer,paymentMethod}=req.body;
    if(!customer?.name||!customer?.phone||!customer?.address||!customer?.pincode)return res.status(400).json({error:"Customer name, phone, address and pincode are required"});
    if(!Array.isArray(items)||!items.length)return res.status(400).json({error:"Cart is empty"});
    const products=readJSON(DATA);
    let total=0,clean=[];
    for(const x of items){
      const p=products.find(y=>y.id===x.id); const qty=Math.max(1,Number(x.qty||1));
      if(!p)return res.status(400).json({error:"Product not found"});
      if(p.stock<qty)return res.status(400).json({error:`Only ${p.stock} left for ${p.name}`});
      total+=p.price*qty; clean.push({id:p.id,name:p.name,price:p.price,qty,size:x.size||""});
    }
    const orderId="SB"+Date.now();
    const orders=readJSON(ORDERS);
    const order={id:orderId,items:clean,customer,paymentMethod,status:paymentMethod==="cod"?"COD — Order Placed":"PAYMENT_PENDING",amount:total,createdAt:new Date().toISOString()};
    orders.push(order);writeJSON(ORDERS,orders);
    if(paymentMethod==="cod")return res.json({cod:true,orderId,total});
    const r=razor(); if(!r)return res.status(503).json({error:"Online payment is not configured. Add Razorpay keys in .env."});
    const rz=await r.orders.create({amount:total*100,currency:"INR",receipt:orderId,notes:{store:"STYLO BUYZ",customer_phone:customer.phone}});
    order.razorpayOrderId=rz.id; orders[orders.length-1]=order;writeJSON(ORDERS,orders);
    res.json({keyId:process.env.RAZORPAY_KEY_ID,razorpayOrderId:rz.id,orderId,total});
  }catch(e){console.error(e);res.status(500).json({error:"Could not create order"});}
});
app.post("/api/verify-payment",(req,res)=>{
  try{
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature,orderId}=req.body;
    const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id+"|"+razorpay_payment_id).digest("hex");
    if(expected!==razorpay_signature)return res.status(400).json({error:"Payment signature verification failed"});
    const o=readJSON(ORDERS),i=o.findIndex(x=>x.id===orderId);
    if(i>=0){o[i].status="PAID";o[i].razorpayPaymentId=razorpay_payment_id;writeJSON(ORDERS,o)}
    res.json({ok:true,orderId});
  }catch(e){res.status(500).json({error:"Verification failed"});}
});
app.post("/api/razorpay-webhook",(req,res)=>{
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(secret){
    const sig=req.headers["x-razorpay-signature"];
    const expected=crypto.createHmac("sha256",secret).update(JSON.stringify(req.body)).digest("hex");
    if(sig!==expected)return res.status(400).send("bad signature");
  }
  const event=req.body.event||"";
  if(event==="payment.captured" && req.body.payload?.payment?.entity){
    const pay=req.body.payload.payment.entity, rzid=pay.order_id;
    const o=readJSON(ORDERS),i=o.findIndex(x=>x.razorpayOrderId===rzid);
    if(i>=0){o[i].status="PAID";o[i].razorpayPaymentId=pay.id;writeJSON(ORDERS,o)}
  }
  res.json({received:true});
});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.listen(PORT,()=>console.log(`STYLO BUYZ running at http://localhost:${PORT}`));
