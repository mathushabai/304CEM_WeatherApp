const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const app = express();
const port = 3000;
const apiKey = '978af5af71ed005b1897ec9548c8856e';

const weatherCache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60 // limit each IP to 60 requests per windowMs
});

app.use(limiter);
app.use(express.static('public'));
app.use(express.json()); // To parse JSON request bodies
app.use(bodyParser.json());

const uri = 'mongodb+srv://mathushabai:aU7oiozM55KWEWl0@weather-cities.jnwwqi4.mongodb.net/?retryWrites=true&w=majority&appName=weather-cities';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
let db;

const connectToMongoDB = async () => {
    try {
        await client.connect();
        db = client.db('weather-city');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB', err);
        process.exit(1);
    }
};


app.get('/weather/:city', async (req, res) => {
    const city = req.params.city.toLowerCase();
    const cacheKey = `weather_${city}`;
    const cachedWeather = weatherCache.get(cacheKey);

    if (cachedWeather) {
        return res.json(cachedWeather);
    }

    try {
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);
        weatherCache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            res.status(404).send('City not found');
        } else {
            console.error('Error fetching weather data:', error.message);
            res.status(500).send('Error fetching weather data');
        }
    }
});

app.get('/weather', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).send('Latitude and Longitude are required');
    }

    const cacheKey = `weather_${lat}_${lon}`;
    const cachedWeather = weatherCache.get(cacheKey);

    if (cachedWeather) {
        return res.json(cachedWeather);
    }

    try {
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`);
        weatherCache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching weather data:', error.message);
        res.status(500).send('Error fetching weather data');
    }
});

app.get('/forecast/:city', async (req, res) => {
    const city = req.params.city.toLowerCase();
    const cacheKey = `forecast_${city}`;
    const cachedForecast = weatherCache.get(cacheKey);

    if (cachedForecast) {
        return res.json(cachedForecast);
    }

    try {
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`);
        weatherCache.set(cacheKey, response.data);
        res.json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            res.status(404).send('City not found');
        } else {
            console.error('Error fetching forecast data:', error.message);
            res.status(500).send('Error fetching forecast data');
        }
    }
});

app.get('/favorites', async (req, res) => {
    try {
        const collection = db.collection('favorite-city');
        const favorites = await collection.find().toArray();
        res.json(favorites);
    } catch (error) {
        console.error('Error fetching favorites:', error.message);
        res.status(500).send('Error fetching favorites');
    }
});

app.post('/favorites', async (req, res) => {
    const { city } = req.body;
    if (!city) {
        return res.status(400).send('City not provided');
    }

    const normalizedCity = city.toLowerCase();

    try {
        // Fetch latitude and longitude of the city
        const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${normalizedCity}&appid=${apiKey}`);
        const { coord } = response.data;
        const latitude = coord.lat;
        const longitude = coord.lon;

        console.log('Request body:', req.body); // Log the request body

        const collection = db.collection('favorite-city');
        const existingCity = await collection.findOne({ city: normalizedCity });

        if (existingCity) {
            return res.status(409).send('City already in favorites');
        }

        await collection.insertOne({ city: normalizedCity, latitude, longitude });
        res.status(201).send('City added to favorites');
    } catch (error) {
        console.error('Error adding city to favorites:', error.message);

        if (error.response) {
            // Log details of the error response
            console.error('Error response data:', error.response.data);
            console.error('Error response status:', error.response.status);
            console.error('Error response headers:', error.response.headers);
        }

        res.status(500).send('Error adding city to favorites');
    }
});

app.delete('/favorites/:city', async (req, res) => {
    const { city } = req.params;
    const normalizedCity = city.toLowerCase();

    try {
        const collection = db.collection('favorite-city');
        const result = await collection.deleteOne({ city: normalizedCity });

        if (result.deletedCount === 0) {
            return res.status(404).send('City not found in favorites');
        }

        res.status(200).send('City removed from favorites');
    } catch (error) {
        console.error('Error removing city from favorites:', error.message);
        res.status(500).send('Error removing city from favorites');
    }
});

connectToMongoDB().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});