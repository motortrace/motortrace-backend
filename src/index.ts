import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
const googleClient =  new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(express.json())

const JWT_SECRET = 'supersecret' // put in .env later

// REGISTER
app.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) return res.status(400).json({ error: 'User already exists' })

  const hashed = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { email, password: hashed, name, role },
  })

  res.json({ message: 'User created', user: { id: user.id, email: user.email, role: user.role } })
})

// LOGIN
app.post('/login', async (req, res) => {
  const { email, password } = req.body

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid password' })

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' })

  res.json({ message: 'Login success', token })
})

// GOOGLE LOGIN

app.post('/auth/google', async(req, res) => {
  const {idToken} = req.body

  if (!idToken) {
    return res.status(400).json({error: 'Missing the idToken'})
  }

  let payload

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch(err) {
    return res.status(401).json({error: 'Invalid google token'})
  }

  if (!payload) {
    return res.status(400).json({error: 'Invalid token payload'})
  }

  const {email, name} = payload
  if (!email) {
    return res.status(400).json({error: 'Email missing in the token!'})
  }

  let user =  await prisma.user.findUnique({where: {email}})
  if (!user) {
    user =  await prisma.user.create({
      data: {
        email,
        name,
        password: '', // dont need for google accounts
        role: 'owner',
      },
    })
  }

  const token = jwt.sign({
    userId: user.id,
    role: user.role
  },
  JWT_SECRET,
  {expiresIn: '1d'})
  res.json({message: 'Google login successful', token})

})
