const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser=require('cookie-parser');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//midlewares
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials:true,
  })
);
app.use(express.json());
app.use(cookieParser());

//own midlewares
const logger=(req,res,next)=>{
  console.log('logger : info ',req.method,req.url);
  next();
}
//verifying token
const VerifyToken=(req,res,next)=>{
  const token=req?.cookies?.token;
  // console.log('token in the midlewares',token);
  //?if token is not exists
  if(!token)
  {
    return res.status(401).send({message:'unauthorized access'});
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err)
    {
      return res.status(401).send({message: 'unauthorized'});
    }
    req.user=decoded;
    next();
  })
}

app.get("/", (req, res) => {
  res.send("This is car Doctor");
});
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z5rmhar.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const ServiceCollection = client.db("CarDoctor").collection("Services");
    const bookingsCollection = client.db("CarDoctor").collection("bookings");
   
    // auth related api
    app.post('/jwt',async(req,res)=>{
      const user=req.body;
      console.log('user for token',user);
      const token=jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
      
      const cookiesOptions={
        httpOnly:true,
        secure:false,
        sameSite:'strict'
      }
      res.cookie('token',token,cookiesOptions)
      .send({success:true});
    })
    //clear user cookies
    app.post('/logout',async(req,res)=>{
      const loggedOutuser=req.body;
      console.log('logging out user',loggedOutuser);
      res.clearCookie('token',{maxAge:0}).send({success:true});
    })

    //services related  api

    //get all
    app.get("/services", async (req, res) => {
      const filter=req.query;
      console.log(filter)
      const query = { 
        title:{$regex:filter.search,$options:'i'}
      };
      const options = {
        sort: {
          price: filter.sort === "asc" ? 1 : -1,
        },
      };
      const cursor = ServiceCollection.find(query,options);
      const result = await cursor.toArray();
      res.send(result);
    });

    //get one
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await ServiceCollection.findOne(query, options);
      res.send(result);
    });

    //bookings

    //get of bookings
    app.get("/bookings", logger,VerifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('token owner info : ',req.user);
      if(req.user.email!==req.query.email)
      {
        return res.status(403).send({message:'forbidden'});
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    //post of bookings
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });
    //delete
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });
    //update
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const updateBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      const result = await bookingsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Car Doctor running on port ${port}`);
});
