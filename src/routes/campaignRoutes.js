const express = require('express');
const protect = require('../middleware/authMiddleware');
const {createCampaign, updateCampaign, deleteCampaign, getCampaigns,  donateToCampaign, searchCampaigns, getCampaignById, getFilteredCampaigns} = require('../controllers/campaignController');

const router = express.Router();

router.post('/', protect, createCampaign);
router.put('/:id', protect, updateCampaign);
router.delete('/:id', protect, deleteCampaign);
router.get('/', getCampaigns);
router.get('/search', searchCampaigns)
router.get('/:id', getCampaignById);
router.post('/:id/donate', protect, donateToCampaign)
router.get('/filter', getFilteredCampaigns)
module.exports = router;
