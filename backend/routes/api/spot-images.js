const express = require("express");
const {
	Spot,
	User,
	SpotImage,
	Review,
	ReviewImage,
	Sequelize,
} = require("../../db/models");
const router = express.Router();

router.delete("/:imageId", async (req, res) => {
	const { user } = req;

	if (user) {
		const image = SpotImage.findByPk(req.params.imageId);
		const spot = Spot.findByPk(image.spotId);
		if (image) {
			if (user.id === spot.ownerId) {
				await image.destroy();
				res.json({ message: "Successfully deleted" });
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
