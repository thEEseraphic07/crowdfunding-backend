const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const {
  createCampaign,
  updateCampaign,
  getCampaigns,
  searchCampaigns,
  getCampaignById,
  // getSingleCampaign,
  getMyCampaigns,
  getTrendingCampaigns
} = require('../controllers/campaignController');

const router = express.Router();

router.post('/', protect, createCampaign);

router.get('/', getCampaigns);

router.get('/trending', getTrendingCampaigns);

router.get('/search', searchCampaigns);

router.get('/mine', protect, getMyCampaigns);

router.get('/:id', getCampaignById);

router.put('/:id', protect, updateCampaign);

module.exports = router;