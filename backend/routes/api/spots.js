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
const { check } = require("express-validator");
const { handleValidationErrors } = require("../../utils/validation");
const { DATE, Model, where } = require("sequelize");
const spotimage = require("../../db/models/spotimage");
const spot = require("../../db/models/spot");

const validateCreation = [
	check("address")
		.exists({ checkFalsy: true })
		.withMessage("Street address is required"),
	check("city").exists({ checkFalsy: true }).withMessage("City is required"),
	check("state").exists({ checkFalsy: true }).withMessage("State is required"),
	check("country")
		.exists({ checkFalsy: true })
		.withMessage("Country is required"),
	check("lat")
		.exists({ checkFalsy: true })
		.isFloat({ min: -90, max: 90 })
		.withMessage("Latitude must be within -90 and 90"),
	check("lng")
		.exists({ checkFalsy: true })
		.isFloat({ min: -180, max: 180 })
		.withMessage("Longitude must be within -180 and 180"),
	check("name")
		.exists({ checkFalsy: true })
		.isLength({ max: 50 })
		.withMessage("Name must be less than 50 characters"),
	check("description")
		.exists({ checkFalsy: true })
		.withMessage("Description is required"),
	check("price")
		.exists({ checkFalsy: true })
		.custom((value) => (value >= 0 ? true : false))
		.withMessage("Price per day must be a positive number"),
	handleValidationErrors,
];

const validateReview = [
	check("review")
		.exists({ checkFalsy: true })
		.withMessage("Review text is required"),
	check("stars")
		.exists({ checkFalsy: true })
		.isFloat({ min: 1, max: 5 })
		.withMessage("Stars must be an integer from 1 to 5"),
	handleValidationErrors,
];

// Get all Spots
router.get("/", async (req, res) => {
	const spots = await Spot.findAll({
		include: [{ model: SpotImage }, { model: Review }],
	});

	// Mutate Spots object to add Avg Rating, previewImage
	let Spots = [];
	spots.forEach((spot) => {
		Spots.push(spot.toJSON());
	});

	Spots.forEach((spot) => {
		// Grab all reviews
		if (spot.Reviews.length) {
			let count = 0;
			// Iterate through reviews to find star count
			spot.Reviews.forEach((review) => {
				count += review.stars;
			});
			spot.avgRating = count / spot.Reviews.length;
		} else {
			spot.avgRating = 0;
		}
		if (spot.SpotImages.length) {
			spot.SpotImages.forEach((image) => {
				if (image.preview === true) {
					spot.previewImage = image.url;
				}
			});
		} else {
			spot.previewImage = "no preview url";
		}
		delete spot.SpotImages;
		delete spot.Reviews;
	});

	res.json({ Spots });
});
// Get all Spots owned by the Current User
router.get("/current", async (req, res) => {
	const { user } = req;

	if (user) {
		const spots = await Spot.findAll({
			where: { ownerId: user.id },
			include: [{ model: SpotImage }, { model: Review }],
		});

		// Array we will be putting all the resolved promises in
		let Spots = [];
		// Iterate through spots, convert to POJO
		spots.forEach((spot) => {
			Spots.push(spot.toJSON());
		});

		Spots.forEach((spot) => {
			// Grab all reviews
			if (spot.Reviews.length) {
				let count = 0;
				// Iterate through reviews to find star count
				spot.Reviews.forEach((review) => {
					count += review.stars;
				});
				spot.avgRating = count / spot.Reviews.length;
			} else {
				spot.avgRating = 0;
			}
			if (spot.SpotImages.length) {
				spot.SpotImages.forEach((image) => {
					if (image.preview === true) {
						spot.previewImage = image.url;
					}
				});
			} else {
				spot.previewImage = "no preview url";
			}
			delete spot.SpotImages;
			delete spot.Reviews;
		});
		res.json({ Spots });
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});
// Get details of a spot by SpotId
router.get("/:spotId", async (req, res) => {
	const spot = await Spot.findByPk(req.params.spotId, {
		attributes: {
			include: [
				[Sequelize.fn("COUNT", Sequelize.col("Reviews.id")), "numReviews"],
				[Sequelize.fn("AVG", Sequelize.col("Reviews.stars")), "avgStarRating"],
			],
		},
		include: [
			{
				model: Review,
				attributes: [],
			},
			{
				model: SpotImage,
				attributes: ["id", "url", "preview"],
			},
			{ model: User, as: "Owner", attributes: ["id", "firstName", "lastName"] },
		],
	});

	if (spot) {
		res.json(spot);
	} else {
		res.status(404).json({ message: "Spot couldn't be found" });
	}
});
// Create a Spot
router.post("/", validateCreation, async (req, res) => {
	const { user } = req;
	const { address, city, state, country, lat, lng, name, description, price } =
		req.body;
	if (user) {
		const newSpot = await Spot.create({
			ownerId: user.id,
			address,
			city,
			state,
			country,
			lat,
			lng,
			name,
			description,
			price,
		});
		res.status(201).json({ newSpot });
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});

// Add an Image to a spot based on the spot's ID
router.post("/:spotId/images", async (req, res) => {
	const { user } = req;
	if (user) {
		const { url, preview } = req.body;
		const spot = await Spot.findByPk(req.params.spotId);
		if (spot) {
			if (spot.ownerId === user.id) {
				const newImage = await SpotImage.create({
					spotId: spot.id,
					url,
					preview,
				});
				res.status(201).json({
					id: newImage.id,
					url: newImage.url,
					preview: newImage.preview,
				});
			} else {
				res.status(403).json({ message: "Forbidden" });
			}
		} else {
			res.status(404).json({ message: "Spot couldn't be found" });
		}
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});

// Edit a spot
router.put("/:spotId", validateCreation, async (req, res) => {
	const { user } = req;
	const { address, city, state, country, lat, lng, name, description, price } =
		req.body;
	if (user) {
		const spot = await Spot.findByPk(req.params.spotId);
		if (spot) {
			if (spot.ownerId === user.id) {
				const updatedSpot = await spot.update({
					address: address,
					city: city,
					state: state,
					country: country,
					lat: lat,
					lng: lng,
					name: name,
					description: description,
					price: price,
					updatedAt: new DATE(),
				});
				res.json(updatedSpot);
			} else {
				res.status(403).json({ message: "Forbidden" });
			}
		} else {
			res.status(404).json({ message: "Spot couldn't be found" });
		}
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});

// Delete a spot
router.delete("/:spotId", async (req, res) => {
	const { user } = req;
	if (user) {
		const spot = await Spot.findByPk(req.params.spotId);
		if (spot) {
			if (user.id === spot.ownerId) {
				await spot.destroy();
				res.status(200).json({ message: "Successfully deleted" });
			} else {
				res.status(403).json({ message: "Forbidden" });
			}
		} else {
			res.status(404).json({ message: "Spot couldn't be found" });
		}
	} else {
		res.status(401).json({ message: "Authentication required" });
	}
});

// Create a review for a spot based on the spot's id
router.post("/:spotId/reviews", validateReview, async (req, res) => {
	const { user } = req;
	const { review, stars } = req.body;

	if (user) {
		const spot = await Spot.findByPk(req.params.spotId);
		if (spot) {
			const reviews = await Review.findOne({ where: { userId: user.id } });
			if (reviews) {
				res
					.status(500)
					.json({ message: "User already has a review for this spot" });
			} else {
				const newReview = await Review.create({
					userId: user.id,
					spotId: spot.id,
					review,
					stars,
				});
				res.status(201).json(newReview);
			}
		} else {
			res.status(404).json({ message: "Spot couldn't be found" });
		}
	}
});

// Get all Reviews by a spot's Id
router.get("/:spotId/reviews", async (req, res) => {
	const spot = await Spot.findByPk(req.params.spotId);
	const reviews = await Review.findAll({
		where: { spotId: req.params.spotId },
		include: [
			{ model: User, attributes: ["id", "firstName", "lastName"] },
			{ model: ReviewImage },
		],
	});
	if (spot) {
		res.json({ reviews });
	} else {
		res.status(404).json({ message: "Spot couldn't be found" });
	}
});

module.exports = router;
