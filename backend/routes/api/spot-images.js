const express = require("express");
const { Spot, User, SpotImage, Review, Booking } = require("../../db/models");
const router = express.Router();

//Delete a Spot Image
router.delete("/:imageId", async (req, res) => {
	const { user } = req;
	const { imageId } = req.params;

	if (user) {
		const spotImage = await SpotImage.findByPk(imageId);
		if (spotImage) {
			const spot = await Spot.findByPk(spotImage.spotId);
			if (user.id === spot.ownerId) {
				await spotImage.destroy();
				res.status(200).json({ message: "Successfully deleted" });
			} else {
				res.status(403).json({ message: "Forbidden" });
			}
		} else {
			res.status(404).json({ message: "Spot Image couldn't be found" });
		}
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});

module.exports = router;
