import Cache from '@/utils/Cache';
import { $, $$, waitFor, observe, createElement, addStyles, anilistApi, ONE_DAY } from '@/utils/Helpers';
import { registerModule } from '@/utils/ModuleLoader';

let running = false;
let observer: MutationObserver;

const processReviews = async () => {
	if (running) return;

	running = true;

	try {
		const reviewElements = $$('.review-wrap .review-card');
		const isHome = /^\/home/i.test(location.pathname);
		const reviewContainers: Record<string, HTMLElement> = {};

		for (const reviewElement of reviewElements) {
			if (isHome) {
				reviewElement.classList.add('is-home');
			}

			const content: HTMLElement = reviewElement.querySelector('.content')!;

			if (content.dataset['scoreFetched']) continue;

			let reviewId = reviewElement.getAttribute('href') ?? content.getAttribute('href');
			reviewId = reviewId!.replace(/\D+/, '');
			reviewContainers[reviewId] = content;
		}

		const reviewIds = Object.keys(reviewContainers).map(Number);

		// Don't continue if theres nothing
		if (!reviewIds.length) return;

		type Review = {
			id: number;
			score: number | null;
		};

		const reviews: Review[] = [];
		const uncachedReviewIds: number[] = [];

		for (const reviewId of reviewIds) {
			const review = await Cache.get('anilist-review', reviewId.toString()) as Review;
			if (review) {
				reviews.push(review);
			} else {
				uncachedReviewIds.push(reviewId);
			}
		}

		if (uncachedReviewIds.length) {
			const queries = uncachedReviewIds.map(r => `review_${r}: Page { reviews(id: ${r}) { id, score } }`);
			const { data } = await anilistApi(`{ ${queries.join('\n')} }`) as AnilistUserReviewsResponse;
			const newReviews = Object.entries(data).map(r => {
				return {
					id: Number.parseInt(r[0].replace('review_', ''), 10),
					score: r[1].reviews[0]?.score ?? null,
				};
			});
			reviews.push(...newReviews);
			for (const review of newReviews) {
				await Cache.set('anilist-review', review.id.toString(), review, ONE_DAY);
			}
		}

		const reviewsData = reviewIds.map(reviewId => {
			const review = reviews.find(r => r && r.id === reviewId);
			return review ?? { id: reviewId, score: null };
		});

		for (const reviewData of reviewsData) {
			const { id: reivewId, score: reviewScore } = reviewData;

			// We are marking the reviews as fetched to avoid fetching them again.
			reviewContainers[reivewId].dataset['scoreFetched'] = 'true';

			// The public api cannot fetch adult content without auth so it will return nothing
			if (reviewScore === null) continue;

			createElement('div', {
				attributes: {
					class: 'alextras--review-score-container',
				},
				children: [
					createElement('p', {
						attributes: {
							class: 'alextras--review-score',
						},
						styles: {
							background: reviewScore < 35
								? 'rgb(var(--color-red))'
								: reviewScore < 65
									? 'rgb(var(--color-orange))'
									: 'rgb(var(--color-green))',
						},
						textContent: reviewScore.toString(),
					}),
				],
				appendTo: reviewContainers[reivewId],
			});
		}

		console.log(`Fetched score for ${reviewsData.length} reviews.`);
	} catch (error: any) {
		console.error(error);
	} finally {
		// eslint-disable-next-line require-atomic-updates
		running = false;
	}
};

registerModule.anilist({
	id: 'addReviewRatings',
	name: 'Review Ratings',
	description: 'Adds the review ratings to the review cards on the homepage and review pages.',
	togglable: true,

	validate({ currentPage }) {
		return currentPage.pathname.startsWith('/home') || // Starts with /home. More than likely the user is on the homepage.
				currentPage.pathname.endsWith('/reviews'); // Ends with /reviews. Either on the overall reviews or anime reviews page.
	},

	async load() {
		const targetLoaded = await waitFor('.review-wrap');

		// If the target element is not found, return.
		if (!targetLoaded) return;

		observer = observe($('.review-wrap')!, () => void processReviews());
		void processReviews();
	},

	unload() {
		observer?.disconnect();
		running = false;
	},
});

addStyles(`
	.review-card:not(.is-home) .summary {
		padding-right: 30px;
	}

	.review-card.is-home .summary {
		padding-bottom: 20px;
	}

	.review-card .alextras--review-score-container {
		position: absolute;
		line-height: 1.2;
		bottom: 2.5em;
		right: 10px;
	}

	.review-card.is-home .alextras--review-score-container {
		bottom: 10px;
		right: 45px;
	}

	.review-card .alextras--review-score {
		color: rgb(var(--color-white));
		text-align: center;
		padding: 0px 5px;
		margin: 0px;
		border-radius: 2px;
		font-size: 1.3rem;
		font-weight: bold;
	}
`);
