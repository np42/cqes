CREATE TABLE `@events` (
  `eventId` bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `category` varchar(64) COLLATE 'ascii_general_ci' NOT NULL,
  `streamId` char(36) COLLATE 'ascii_general_ci' NOT NULL,
  `number` int unsigned NOT NULL,
  `type` varchar(64) COLLATE 'ascii_general_ci' NOT NULL,
  `date` date NOT NULL,
  `time` time(3) NOT NULL,
  `data` longtext COLLATE 'utf8_general_ci' NOT NULL,
  `meta` text COLLATE 'utf8_general_ci' NOT NULL
);
ALTER TABLE `@events`
ADD UNIQUE `category_streamId_number` (`category`, `streamId`, `number`),
ADD INDEX `category_eventId` (`category`, `eventId`);
