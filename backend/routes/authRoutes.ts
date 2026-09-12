import express from 'express';
const router = express.Router()
import {login} from '../controllers/authcontroller';



router.post('/login',login);

module.exports = router;




