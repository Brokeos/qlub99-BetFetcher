const BaseProvider = require('./BaseProvider');
const puppeteer = require("puppeteer");
const cheerio = require('cheerio');

class FlashScoreProvider extends BaseProvider {
	constructor(options = {}) {
		super('FlashScore', options);
		
		this.browser = null;
		this.scrapperPage = null;
		this.sportsConfig = this.normalizeSportsConfig([{
			name: 'Tennis - Wimbledon 2025 - ATP Singles',
			league: 'Wimbledon',
			sport: 'Tennis',
			baseUrl: 'https://www.flashscore.com/tennis/atp-singles/wimbledon'
		}/*,{
			name: 'Tennis - Wimbledon 2025 - WTA Singles',
			league: 'Wimbledon',
			sport: 'Tennis',
			baseUrl: 'https://www.flashscore.com/tennis/wta-singles/wimbledon'
		}*/]);
	}
	
	normalizeSportsConfig(sportsConfig) {
		return sportsConfig.map(sportConfig => {
			if (sportConfig.fixturesUrl && sportConfig.resultsUrl && sportConfig.liveUrl) {
				return sportConfig
			} else {
				return {
					...sportConfig,
					fixturesUrl: `${sportConfig.baseUrl}/fixtures/`,
					resultsUrl: `${sportConfig.baseUrl}/results/`,
					liveUrl: `${sportConfig.baseUrl}`
				}
			}
		})
	}
	
	async initialize() {
		try {
			const launchOptions = {
				headless: false,
				args: ['--no-sandbox', '--disable-setuid-sandbox'],
			}
			
			this.browser = await puppeteer.launch(launchOptions);
			this.scrapperPage = await this.browser.newPage();
			
			await this.scrapperPage.setUserAgent(this.options.userAgent);
			await this.scrapperPage.setViewport({width: 1920, height: 1080});
			
			this.isInitialized = true;
		} catch (error) {
			console.error(`Error initializing FlashScoreProvider: ${error.message}`);
			throw error;
		}
	}
	
	async fetchMatchs() {
		if (!this.isInitialized) {
			throw new Error('FlashScoreProvider is not initialized. Please call initialize() first.');
		}
		
		const fetchStartTime = Date.now();
		const allEvents = [];
		let totalEvents = 0;
		
		try {
			for (const sportConfig of this.sportsConfig) {
				try {
					let allMatches = [];
					let fixturesCount = 0, resultsCount = 0, liveCount = 0;
					const fixturesMatches = await this.fetchSportData(sportConfig, 'fixtures');
					const resultsMatches = await this.fetchSportData(sportConfig, 'results');
					const liveMatches = await this.fetchSportData(sportConfig, 'live');
					
					fixturesCount = fixturesMatches.length;
					resultsCount = resultsMatches.length;
					liveCount = liveMatches.length;
					
					allMatches.push(...fixturesMatches);
					allMatches.push(...resultsMatches);
					allMatches.push(...liveMatches);
					
					allEvents.push(...this.mergeMatches(allMatches));
					totalEvents = allEvents.length;
				} catch (error) {
					console.error(`Error fetching fixtures for ${sportConfig.name}: ${error.message}`);
				}
			}
		} catch (error) {
			console.error(`Error fetching events: ${error.message}`);
			throw error;
		}
		
		const fetchDuration = Date.now() - fetchStartTime;
		
		console.log(`Fetched ${totalEvents} matches in ${fetchDuration}ms`);
		
		if (this.scrapperPage) {
			try {
				await this.scrapperPage.close();
			} catch (error) {
				console.error(`Error closing scrapper page: ${error.message}`);
			}
		}
		
		if (this.browser){
			try {
				await this.browser.close();
			} catch (error) {
				console.error(`Error closing browser: ${error.message}`);
			}
		}
		
		return allEvents;
	}
	
	async fetchSportData(sportConfig, type) {
		let url = type === 'fixtures' ? sportConfig.fixturesUrl : (type === 'results' ? sportConfig.resultsUrl : sportConfig.liveUrl);
		const fetchStart = Date.now();
		
		try {
			const response = await this.scrapperPage.goto(url, {
				waitUntil: 'networkidle2',
				timeout: this.options.timeout
			});
			
			if (!response) {
				throw new Error(`Failed to fetch data from ${url}. Response is undefined.`);
			}
			
			const status = response.status();
			
			if (status === 304) {
				return [];
			}
			
			if (!response.ok()) {
				throw new Error(`Failed to fetch data from ${url}. Status: ${status}`);
			}
			
			const html = await this.scrapperPage.content();
			const matches = this.parseMatches(html, sportConfig);
			const fetchDuration = Date.now() - fetchStart;
			
			if (matches.length > 0) {
				console.log(`Fetched ${matches.length} ${type} matches for ${sportConfig.name} in ${fetchDuration}ms`);
			}
			
			return matches;
		} catch (error) {
			console.error(`Error fetching data for ${sportConfig.name} (${type}): ${error.message}`);
		}
		
		return [];
	}
	
	parseMatches(html, sportConfig) {
		const $ = cheerio.load(html);
		const matches = [];
		
		try {
			const matchElements = $('.event__match[data-event-row="true"]');
			
			matchElements.each((index, element) => {
				try {
					const match = this.parseMatch($, $(element), sportConfig);
					
					if (match) {
						matches.push(match);
					}
				} catch (error) {
					console.error(`Error parsing match at index ${index} for ${sportConfig.name}: ${error.message}`);
				}
			})
		} catch (error) {
			console.error(`Error parsing matches for ${sportConfig.name}: ${error.message}`);
		}
		
		return matches;
	}
	
	parseMatch($, element, sportConfig) {
		try {
			let homeParticipant = this.cleanParticipantName($, element.find('.event__participant--home'));
			let awayParticipant = this.cleanParticipantName($, element.find('.event__participant--away'));
			
			if (!homeParticipant || !awayParticipant) {
				homeParticipant = this.cleanParticipantName($, element.find('.event__homeParticipant'));
				awayParticipant = this.cleanParticipantName($, element.find('.event__awayParticipant'));
			}
			
			if (!homeParticipant || !awayParticipant) {
				const participants = element.find('.eventRowLink span');
				
				if (participants.length >= 2) {
					homeParticipant = this.cleanParticipantName($, $(participants[0]));
					awayParticipant = this.cleanParticipantName($, $(participants[1]));
				}
			}
			
			if (!homeParticipant || !awayParticipant) {
				console.warn(`⚠️ Could not extract participant names for match: ${timeText}`);
				return null;
			}
			
			const stageElement = element.find('.event__stage--block');
			const stageText = stageElement.text().trim().toLowerCase();
			
			let homeScore = null;
			let awayScore = null;
			let status = 'scheduled';
			
			if (stageText === 'cancelled') {
				status = 'cancelled';
			} else {
				const homeScoreElement = element.find('.event__score--home');
				const awayScoreElement = element.find('.event__score--away');
				const homeScoreText = homeScoreElement.text().trim();
				const awayScoreText = awayScoreElement.text().trim();
				
				if (homeScoreText !== '-' && awayScoreText !== '-') {
					const scoreState = homeScoreElement.attr('data-state');
					
					if (scoreState === 'final'){
						status = 'finished';
						homeScore = this.parseScore(homeScoreText);
						awayScore = this.parseScore(awayScoreText);
					} else if (scoreState === 'live') {
						status = 'live';
						homeScore = this.parseScore(homeScoreText);
						awayScore = this.parseScore(awayScoreText);
					} else if (scoreState === 'cancelled') {
						status = 'cancelled';
						homeScore = null;
						awayScore = null;
					}
				}
			}
			
			const timeElement = element.find('.event__time');
			const timeText = timeElement.text().trim();
			const matchDate = this.parseDate(timeText);
			
			let eventId = null;
			const matchId = element.attr('id');
			
			if (matchId) {
				eventId = matchId.replace('g_', '').split('_').pop();
			}
			
			if (!eventId) {
				const linkHref = matchId.find('a.eventRowLink').attr('href');
				
				if (linkHref) {
					const hrefMatch = linkHref.match(/\/([a-zA-Z0-9]+)\//);
					if (hrefMatch) {
						eventId = hrefMatch[1];
					}
				}
			}
			
			if (!eventId) {
				console.warn(`⚠️ Could not extract event ID for match: ${homeParticipant} vs ${awayParticipant}`);
				return null;
			}

			return {
				homeParticipant: homeParticipant,
				awayParticipant: awayParticipant,
				date: matchDate,
				homeScore: homeScore,
				awayScore: awayScore,
				status: status,
				sport: sportConfig.sport,
				league: sportConfig.league,
				id: eventId
			};
		} catch (error) {
			console.error(`Error parsing match element: ${error.message}`);
			return null;
		}
	}
	
	cleanParticipantName($, element) {
		if (!element || !element.length) return '';
		
		const clone = element.clone();
		
		clone.find('.highlightMsg').remove();
		clone.find('.fontBold').remove();

		return clone.text().trim().replace(/\s+/g, ' ').trim();
	}
	
	parseScore(scoreText) {
		if (!scoreText || scoreText === '-') return null;
		
		const score = parseInt(scoreText, 10);
		
		return isNaN(score) ? null : score;
	}
	
	parseDate(dateText) {
		if (!dateText) return null;
		
		if (/^\d{1,2}:\d{2}$/.test(dateText)) {
			const [h, m] = dateText.split(':').map(Number);
			if (h > 23 || m > 59) return null;
			const date = new Date();
			date.setHours(h, m, 0, 0);
			return date;
		}
		
		if (/^\d{1,2}[.\/]\d{1,2}[.\/]? \d{1,2}:\d{2}$/.test(dateText)) {
			const [datePart, timePart] = dateText.split(' ');
			const [d, mo] = datePart.split(/[.\/]/).map(Number);
			const [h, m] = timePart.split(':').map(Number);
			if (d > 31 || mo > 12 || h > 23 || m > 59) return null;
			return new Date(new Date().getFullYear(), mo - 1, d, h, m, 0, 0);
		}
		
		return null;
	}
	
	
	mergeMatches(allMatches) {
		const statusPriority = { cancelled: 1, finished: 2, live: 3, scheduled: 4 };
		
		return Object.values(
			allMatches.reduce((groups, match) => {
				(groups[match.id] ||= []).push(match);
				return groups;
			}, {})
		).map(matches => {
			if (matches.length === 1) return matches[0];
			
			const priorityMatch = matches.reduce((best, curr) =>
				(statusPriority[curr.status] || 999) < (statusPriority[best.status] || 999) ? curr : best
			);
			
			const scheduledMatch = matches.find(m => m.status === 'scheduled');
			
			return {
				...matches[0],
				homeScore: priorityMatch.homeScore,
				awayScore: priorityMatch.awayScore,
				status: priorityMatch.status,
				...(scheduledMatch && { date: scheduledMatch.date })
			};
		});
	}
}

module.exports = FlashScoreProvider;