const express = require('express');
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

app.listen(port, () => {
    console.log(`Weather app listening at http://localhost:${port}`);
});