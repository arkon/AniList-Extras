import { $, waitFor, createElement, removeElements, malApi, ONE_HOUR } from '@/utils/Helpers';
import { registerModule } from '@/utils/ModuleLoader';

registerModule.anilist({
	id: 'addMalScoreAndLink',

	validate({ pathname }) {
		return /^\/(anime|manga)\/\d+/.test(pathname);
	},

	async load({ media }) {
		const targetLoaded = await waitFor('.sidebar .rankings');

		// If the target element or mal id is not found, return.
		if (!targetLoaded || !media?.malId) return;

		// Fetch MAL data.
		const { data: malData } = await malApi(`${media.type}/${media.malId}`, ONE_HOUR) as MalAnimeResponse;

		let attrName: string;

		// In some cases this element may exist. We will wait/check to see if it
		// does and if not we will create it ourselves.
		if (await waitFor('a.ranking', 500)) {
			const attrEl = $('a.ranking');
			attrName = attrEl!.attributes[0].name;
		} else {
			// Setting the "data-v-" attribute manually is not ideal as
			// this could change in the future but it'll do for now.
			attrName = 'data-v-a6e466b2';
		}

		const container = createElement('a', {
			attributes: {
				[attrName]: '',
				class: 'ranking alextras--mal-score',
				href: `https://myanimelist.net/${media.type}/${media.malId}/`,
				target: '_blank',
			},
			styles: {
				'margin-bottom': '16px',
			},
			children: [
				createElement('span', {
					attributes: {
						[attrName]: '',
						class: 'rank-text',
					},
					styles: {
						'text-align': 'center',
						width: '100%',
					},
					textContent: `MAL Score: ${malData.score ?? 'N/A'}`,
				}),
			],
		});

		// Ensure the element is inserted in the order we want.
		if ($('.alextras--anilist-score')) {
			$('.alextras--anilist-score')!.after(container);
		} else {
			$('div.rankings')!.append(container);
		}
	},

	unload() {
		removeElements('.alextras--mal-score');
	},
});
