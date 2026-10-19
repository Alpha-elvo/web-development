# Day 7 Assignment: Scaling a Photo-Sharing App

## 1. Assumptions

SnapShare is a photo-sharing application where users upload photos and view a feed containing photos from people they follow.

The design uses these assumptions:

- There are 10 million registered users.
- 10% of registered users are active each day.
- Each daily active user uploads one photo per day.
- Each daily active user views 50 feed pages per day.
- An original photo averages 2 MB.
- Each photo produces one thumbnail averaging 50 KB.
- A day contains 86,400 seconds, and a year contains 365 days.
- Average request rates are calculated across the entire day.
- Peak feed traffic is estimated at five times the average.
- Storage estimates use decimal units: 1 TB = 1,000 GB.
- The estimates exclude database metadata, backups, replication, and storage overhead.

## 2. Traffic and Storage Estimates

### Daily active users

Daily active users = Registered users × Daily active percentage

= 10,000,000 × 0.10

= **1,000,000 daily active users**

### Photo uploads per second

Daily uploads = 1,000,000 users × 1 upload

= 1,000,000 uploads per day

Average uploads per second = 1,000,000 ÷ 86,400

= 11.57, or approximately **12 uploads per second**.

### Feed views per second

Daily feed views = 1,000,000 users × 50 views

= 50,000,000 feed views per day

Average feed views per second = 50,000,000 ÷ 86,400

= 578.70, or approximately **579 feed views per second**.

Peak feed views per second = 578.70 × 5

= 2,893.52, or approximately **2,900 feed views per second**.

### Storage per year

Original photo storage per day:

1,000,000 × 2 MB = 2,000,000 MB = 2 TB.

Original photo storage per year:

2 TB × 365 = **730 TB per year**.

Thumbnail storage per day:

1,000,000 × 50 KB = 50,000,000 KB = 50 GB.

Thumbnail storage per year:

50 GB × 365 = **18.25 TB per year**.

Combined original photo and thumbnail storage:

730 TB + 18.25 TB = **748.25 TB per year**.

These figures represent new stored content before accounting for backups, replication, metadata, or other overhead.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a **read-heavy system** because users generate approximately 50 million feed views daily compared with 1 million photo uploads.

There are about 50 feed views for every upload.

The design should therefore prioritize fast feed delivery. A cache reduces repeated database queries, a database read replica handles additional read traffic, and a CDN delivers image files from locations closer to users. The primary database handles writes, while object storage holds the original photos and thumbnails.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in object storage rather than directly inside the relational database.

Photo files are large binary objects, and storing them directly in database tables can increase database size, backups, replication costs, and resource usage. Object storage is designed to store and retrieve large files efficiently and can scale independently of the database.

The database should store photo metadata, such as the photo ID, owner ID, object-storage key, caption, and upload timestamp. The actual image files belong in object storage, while a CDN can cache and deliver them efficiently.

## 5. Architecture Diagram

```text
                    +------------------+
                    |      Users       |
                    +--------+---------+
                             |
                    +--------v---------+
                    |       CDN        |
                    | Cached images    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Load Balancer   |
                    +--------+---------+
                             |
                 +-----------+-----------+
                 |           |           |
            +----v----+ +----v----+ +----v----+
            | App     | | App     | | App     |
            | Server  | | Server  | | Server  |
            +----+----+ +----+----+ +----+----+
                 |           |           |
                 +-----------+-----------+
                             |
               +-------------+-------------+
               |             |             |
          +----v----+   +----v-----+  +----v------+
          | Redis   |   | Primary  |  | Object    |
          | Cache   |   | Database |  | Storage   |
          +---------+   +----+-----+  | Photos    |
                               |       +------------+
                         +-----v------+
                         | Read       |
                         | Replica    |
                         +------------+

                  Asynchronous thumbnail pipeline

            +----------------+       +----------------+
            | Upload App     |------>| Job Queue      |
            +----------------+       +-------+--------+
                                             |
                                    +--------v--------+
                                    | Thumbnail       |
                                    | Worker          |
                                    +--------+--------+
                                             |
                                    +--------v--------+
                                    | Object Storage  |
                                    | Thumbnail File  |
                                    +-----------------+
```

## 6. Components and the Problems They Solve

- **CDN:** Delivers cached images and other static files from nearby locations, reducing latency and origin-server traffic.
- **Load balancer:** Distributes incoming requests across healthy app servers to avoid overloading a single server.
- **App servers:** Execute application logic, authenticate users, validate uploads, and generate feed responses; keeping them stateless makes horizontal scaling easier.
- **Redis cache:** Stores frequently accessed feed data and metadata so repeated reads do not always reach the database.
- **Primary database:** Stores durable relational data such as users, follows, photo metadata, and feed relationships, and handles application writes.
- **Database read replica:** Serves eligible read queries to reduce load on the primary database and improve read scalability.
- **Object storage:** Stores original photos and generated thumbnails independently of the relational database.
- **Job queue:** Holds thumbnail-generation jobs so image processing can happen asynchronously instead of delaying upload responses.
- **Thumbnail worker:** Retrieves queued jobs, generates smaller image versions, and saves the thumbnails to object storage.

## 7. Step-by-Step Photo Upload Flow

1. A user selects a photo and submits it to SnapShare.
2. The load balancer routes the request to a healthy app server.
3. The app server authenticates the user, validates the upload, and checks file type and size limits.
4. The original photo is stored in object storage, using a unique object key.
5. The app server records the photo's metadata and object key in the primary database.
6. The server invalidates or updates any affected cached feed data.
7. The server places a thumbnail-generation job on the queue.
8. The server confirms the upload once the original file and required metadata have been saved and the job has been accepted by the queue.
9. A thumbnail worker retrieves the queued job and generates a smaller version of the original image.
10. The worker stores the thumbnail in object storage and updates its metadata or processing status.
11. The CDN can subsequently cache and deliver the thumbnail and original photo to viewers.

If thumbnail generation fails, the job can be retried, with appropriate retry limits and failure monitoring. The original photo remains available even while thumbnail processing is pending.

## 8. Design Trade-Offs

### Trade-off 1: Cache speed versus data freshness

Caching makes feed requests faster and reduces database load. However, cached feed data can become stale after a user uploads a photo or changes a follow relationship. The application must invalidate or refresh affected cache entries, adding complexity and some cache misses.

### Trade-off 2: Read replicas versus consistency

A read replica increases read capacity and reduces primary database load. However, replication can lag behind the primary database, so a newly uploaded photo may not immediately appear in a feed read from the replica. The application can route selected read-after-write requests to the primary database when fresher results are required.

### Trade-off 3: Asynchronous thumbnails versus immediate availability

A queue and worker keep image processing out of the main upload request, improving responsiveness. However, thumbnails may not be ready immediately, and the system needs retry handling, monitoring, and a fallback for failed jobs.

### Trade-off 4: Object storage and CDN versus operational complexity

Object storage and a CDN scale image delivery efficiently and reduce database load. However, they introduce additional services, storage and bandwidth costs, cache invalidation challenges, and access-control requirements.

## Conclusion

SnapShare should use horizontally scalable, stateless app servers; a load balancer; Redis caching; a primary database with a read replica; object storage; a CDN; and an asynchronous thumbnail-processing pipeline.

The estimated workload is 1 million daily active users, approximately 12 uploads per second, 579 average feed views per second, and around 2,900 peak feed views per second. Original photos and thumbnails require approximately 748.25 TB of additional storage per year before overhead.

Because the system is read-heavy, caching, efficient image delivery, and database read scaling are central to the design.
