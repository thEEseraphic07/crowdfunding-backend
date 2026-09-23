const axios = require("axios");

const getLocationFromIP = async (ip) => {
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`);

    return {
      country: res.data.country,
      city: res.data.city,
      region: res.data.regionName
    };
  } catch (err) {
    return null;
  }
};

module.exports = getLocationFromIP;