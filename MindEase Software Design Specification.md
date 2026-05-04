College of Technology and Built Environment  
School of Information Technology and Engineering  
MindEase  
Software Design Specification

**Team Members:** 


| No  | Name              | ID          |
| --- | ----------------- | ----------- |
| 1   | Amanuel Tsehay    | UGR/6705/14 |
| 2   | Anatoli Derese    | UGR/6458/14 |
| 3   | Bikila Tariku     | UGR/8089/14 |
| 4   | Yonatan Alebachew | UGR/4429/14 |
| 5   | Zemenu Mekuria    | UGR/5017/14 |










**[List of Tables	5](#list-of-tables)**

**[List of Figures	5](#list-of-figures)**

**[Definitions, Acronyms, Abbreviations	6](#definitions,-acronyms,-abbreviations)**

**[1 Introduction	8](#heading=)**

**[1.1 Purpose	8](#heading=)**

**[1.2 General Overview	8](#heading=)**

**[System Context	8](#heading=)**

**[Design Goals	9](#heading=)**

**[High-Level Context	9](#heading=)**

[1.3 Development Methods & Contingencies	10](#1.3-development-methods-&-contingencies)

[Development Methodology and Architectural Approach	10](#development-methodology-and-architectural-approach)

[Technology Stack:	11](#technology-stack:)

[Development Contingencies	11](#development-contingencies)

[Development Environment	12](#development-environment)

[2 System Architecture	14](#2.-system-architecture)

[2.1 Subsystem Decomposition	14](#2.1-subsystem-decomposition)

**[Level 1: High-Level System Components	14](#heading=)**

[2.2 Hardware/Software Mapping	15](#2.2-hardware/software-mapping)

[Deployment Specifications	16](#deployment-specifications)

**[3 Object Model	17](#heading=)**

**[3.1 Class Diagram	17](#heading=)**

**[Key Design Patterns in Class Structure	20](#heading=)**

**[3.2 Sequence Diagrams	21](#heading=)**

**[3.2.1 User Authentication Sequence	21](#heading=)**

**[3.2.2 Chat Session Sequence	22](#heading=)**

**[3.2.3 Mood Tracking Sequence	23](#heading=)**

**[3.2.4 Avatar Session Sequence	24](#heading=)**

[3.3 State Chart Diagrams	25](#3.3-state-chart-diagrams)

**[4 Detailed System Design	27](#heading=)**

[4.1 Authentication Service (Auth Service)	27](#4.1-authentication-service-(auth-service))

[4.1.1 Overview	27](#4.1.1-overview)

[4.1.2 Component Architecture	27](#4.1.2-component-architecture)

[4.1.3 Database Schema	28](#4.1.3-database-schema)

[4.1.4 Authentication Flow  Google OAuth	29](#4.1.4-authentication-flow---google-oauth)

[4.2 Chat Service	30](#4.2-chat-service)

[4.2.1 Overview	30](#4.2.1-overview)

[4.2.2 Component Architecture	30](#4.2.2-component-architecture)

[4.2.3 Database Schema	30](#4.2.3-database-schema)

[4.2.4 Real-time Chat Flow with AI Integration	31](#4.2.4-real-time-chat-flow-with-ai-integration)

[4.2.5 WebSocket Connection Management	31](#4.2.5-websocket-connection-management)

[4.3 AI/NLP Microservice (MentalLama Model)	33](#4.3-ai/nlp-microservice-(mentallama-model))

[4.3.1 Overview	33](#4.3.1-overview)

[4.3.2 Component Architecture	33](#4.3.2-component-architecture)

[4.3.3 Model Fine Tuning Pipeline	33](#4.3.3-model-fine-tuning-pipeline)

[4.4 Mood Service	35](#4.4-mood-service)

[4.4.1 Overview	35](#4.4.1-overview)

[4.4.2 Component Architecture	35](#4.4.2-component-architecture)

[4.4.3Mood Entry Flow	36](#4.4.3mood-entry-flow)

**[5 Use case diagrams	37](#5.-use-case-diagrams)**

[5.1 New User Registration and First Chat	37](#5.1-new-user-registration-and-first-chat)

[5.2 Guest User Session	38](#5.2-guest-user-session)

[5.3 Daily Mood Check-in	39](#5.3-daily-mood-check-in)

[5.4 Crisis Intervention	40](#5.4-crisis-intervention)

[5.5 Therapist Avatar Session	41](#5.5-therapist-avatar-session)

[5.6 Self-Assessment Completion	42](#5.6-self-assessment-completion)

[5.7 Data Export	43](#5.7-data-export)

**[6 References	44](#6.-references)**

[Technical Bibliography & Reference Table	44](#technical-bibliography-&-reference-table)

[Critical Online Resources	45](#heading)



# **List of Tables** {#list-of-tables}

- *Table 1: Definitions, Acronyms, Abbreviations*  
- *Table 2: User Database Schema*  
- *Table 3: Chat Database Schema*  
- *Table 4: Technical Bibliography*

# **List of Figures** {#list-of-figures}

- *Figure 1: High-Level System Architecture*  
- *Figure 2: Deployment Diagram*  
- *Figure 3: Overall Class Diagram*  
- *Figure 4: Assessment Class Diagram*  
- *Figure 5: User Mgmt, Session Management and Comms*   
- *Figure 6: Resources & Badges System*  
- *Figure 7: Authentication Sequence Diagram*  
- *Figure 8: Chat Session Sequence Diagram*  
- *Figure 9: Mood Tracking Sequence Diagram*  
- *Figure 10: Avatar Session Sequence Diagram*  
- *Figure 11: Conversation State chart*  
- *Figure 12:User Authentication State Chart*  
- *Figure 13:Auth Component Architecture*  
- *Figure 14: Chat Service Architecture*  
- *Figure 15: Realtime chat flow*  
- *Figure 16: Websocket connection management*  
- *Figure 17: AI/NLP component architecture*  
- *Figure 18:Fine tuning pipeline*  
- *Figure 19: Mood Service architecture*  
- *Figure 20: Mood Entry Flow*

# **Definitions, Acronyms, Abbreviations** {#definitions,-acronyms,-abbreviations}

Table 1: definitions, acronyms, abbreviations


| Term        | Definition                                         |
| ----------- | -------------------------------------------------- |
| API         | Application Programming Interface                  |
| FastAPI     | Modern Python web framework for building APIs      |
| Next.js     | React framework for production-grade applications  |
| NLP         | Natural Language Processing                        |
| AI          | Artificial Intelligence                            |
| JWT         | JSON Web Token                                     |
| OAuth       | Open Authorization standard                        |
| CORS        | Cross-Origin Resource Sharing                      |
| ORM         | Object-Relational Mapping                          |
| REST        | Representational State Transfer                    |
| HTTPS       | Hypertext Transfer Protocol Secure                 |
| WebSocket   | Protocol for real-time bidirectional communication |
| CBT         | Cognitive Behavioral Therapy                       |
| GAD-7       | Generalized Anxiety Disorder 7-item scale          |
| PHQ-9       | Patient Health Questionnaire-9                     |
| PostgreSQL  | Open-source relational database system             |
| SQLAlchemy  | Python SQL toolkit and ORM                         |
| Pydantic    | Data validation library for Python                 |
| TailwindCSS | Utility-first CSS framework                        |
| SSR         | Server-Side Rendering                              |
| SSG         | Static Site Generation                             |
|             |                                                    |


# **1 Introduction**

## **1.1 Purpose**

The purpose of this Software Design Specification (SDS) document is to translate the business requirements and business processes defined in the MindEase Software Requirements Specification into a comprehensive technical design that will guide the development of the application. This document serves as the blueprint for the development team, providing detailed architectural decisions, component designs, data models, and interface specifications necessary to implement the MindEase mental health support platform.

This SDS bridges the gap between what the system should do (defined in the SRS) and how it will be built. It provides sufficient detail for developers to implement the system while maintaining flexibility for implementation decisions within the defined architecture.

## **1.2 General Overview**

MindEase is a web-based mental health support platform powered by artificial intelligence that provides users with immediate and  private emotional assistance. The system architecture follows a modern three-tier web application pattern utilizing cutting-edge technologies to ensure scalability, maintainability, and optimal user experience.



### **System Context**

The MindEase platform consists of the following major components:

**Frontend Layer (Client):** Built with Next.js 14 and React, providing a responsive, accessible web interface that runs in modern browsers and as a mobile application provided as a PWA ( progressive web app). The frontend handles user interactions, state management, real-time chat display, data visualization for mood tracking, and consumption of backend APIs.

**Backend Layer (Server):** Implemented using FastAPI (Python), serving as the application server that processes business logic, manages user authentication and authorization, coordinates AI/NLP services, handles data persistence operations, and exposes RESTful APIs with WebSocket support for real-time chatting features.

**Data Layer:** Utilizes PostgreSQL as the primary relational database for structured data storage with encryption for  sensitive information. Implements connection pooling for performance and supports database migrations for schema evolution.

**External Services:** Integrates with third-party AI/NLP microservices for emotion detection and response generation, Google OAuth for authentication, email or other pub/sub services for notifications, and push notification services for user engagement.

### **Design Goals**

The architectural design prioritizes the following objectives:

1. **Security and Privacy:** End-to-end encryption for sensitive user data, secure authentication mechanisms, compliance with data protection best practices.
2. **Scalability:** Horizontal scaling capability to support growing user base, efficient database design and query optimization, caching strategies for frequently accessed data
3. **Performance:** Quick page loads and API response times, real-time chat functionality with minimal latency and streaming for near real-time responses, optimized database queries and indexing
4. **Maintainability:** Modular architecture with clear separation of concerns, comprehensive API documentation, consistent coding standards and design patterns
5. **Accessibility:** WCAG 2.1 Level AA compliance, responsive design for multiple device types, keyboard navigation and screen reader support
6. **Reliability:** 99.5% uptime target, automated backup and recovery procedures, comprehensive error handling and logging

### **High-Level Context**

The system operates within the broader ecosystem of digital mental health solutions. Users access MindEase through web browsers on various devices. The application does not integrate directly with Electronic Health Records or other clinical systems but provides data export functionality for users to share information with healthcare providers at their discretion. The system complements traditional therapy services rather than replacing them.



## **1.3 Development Methods & Contingencies** {#1.3-development-methods-&-contingencies}

### **Development Methodology and Architectural Approach** {#development-methodology-and-architectural-approach}

The MindEase project follows an **Agile development methodology** with two-week sprints combined with **Clean Architecture principles** and **microservices architecture**. 

The architecture consists of four distinct layers:

1. **Domain Layer** containing core business entities (User, Conversation, Message, MoodEntry, Resource) with framework-independent business logic;
2. **Application Layer** implementing use cases (UserAuthentication, ConversationManagement, MoodTracking, ResourceRecommendation, CrisisDetection) and defining interfaces for outer layers;
3. **Interface Adapters Layer** handling REST API controllers, WebSocket handlers, database repositories, and DTOs;
4. **Infrastructure Layer** managing PostgreSQL, Redis caching, OAuth integration, and external services.

The system employs **object-oriented design** with SOLID principles, **API-First design** using OpenAPI/Swagger specifications, and **UML diagrams** (class, sequence, component) for design documentation. 

An automated **CI/CD pipeline** includes builds, static analysis, testing, staging deployment, manual production approval, and rollback mechanisms.

### **Technology Stack:**  {#technology-stack:}

**Frontend** (React 18, TypeScript, Tailwind CSS, Redux Toolkit,socket-IO client),

**Backend** (FastAPI, Python, Prisma ORM, [Socket.io](http://Socket.io))

**Database** (PostgreSQL with pgvector extension, Redis)

**AI/NLP Microservice** (Python FastAPI, fine-tuned MentalLlama model using LoRA adapters via Unsloth/Axolotl framework, therapy-style conversation dataset in JSONL format, local inference using Ollama/llama.cpp, PyTorch for model serving), 

**Infrastructure** (Docker, NGINX reverse proxy, GitHub Actions CI/CD). 

The NLP microservice is independently deployed and communicates with the main backend via messaging queues for load management and independent scaling.

### **Development Contingencies** {#development-contingencies}

**AI/NLP Model Performance**:  

*Risk*  Fine-tuned model may not generate appropriate therapeutic responses or model inference too slow. 

*Contingency*  Implement response quality monitoring and flagging system; maintain fallback to rule-based response templates; design model version management for A/B testing; implement response caching for common queries; configure inference optimization (quantization, batching). 

**AI Service Infrastructure**: 

*Risk*  NLP microservice becomes unavailable or crashes under load. 

*Contingency*  Deploy multiple NLP service instances with load balancing; implement request queue with timeout handling; add circuit breaker pattern; maintain cached responses for critical scenarios. 

**OAuth Provider Changes**: 

*Risk*  Google OAuth API disruption. 

*Contingency*  Support email/password as primary authentication; implement multi-provider OAuth abstraction layer; graceful degradation to email auth.

 **Database Performance**: 

*Risk*  Database bottleneck with user growth. 

*Contingency*  Implement read replicas; Redis caching layer for frequent queries; proactive query optimization and indexing; horizontal scaling with sharding capability. 

**Real-time Chat Scalability**: 

*Risk*  WebSocket connections don't scale.

*Contingency*  Connection pooling and load balancing; message queue (RabbitMQ/Redis Pub/Sub) for horizontal scaling; polling fallback mechanism; connection state management.

### **Development Environment** {#development-environment}

**Version Control**: Git with feature branch workflow, pull request reviews, semantic versioning. 

**Development Setup**: Docker Compose for local environment, environment variables for configuration, automated database seeding, hot reload for frontend/backend. 

**Code Quality**: ESLint/Prettier (frontend), Black/isort (Python), pre-commit hooks, mandatory code reviews.

 **Model Development**: Jupyter notebooks for dataset preparation, Weights & Biases for training monitoring, versioned model artifacts, separate training and inference environments.

**Code Quality:** ESLint and Prettier for frontend code formatting, Black and isort for Python code formatting, pre-commit hooks for code quality checks, and code review process for all changes.

## **2 System Architecture** {#2.-system-architecture}

### **2.1 Subsystem Decomposition** {#2.1-subsystem-decomposition}

The MindEase system follows a **three-tier architecture** with clear separation of concerns. The system is decomposed into the following major subsystems:

### **Level 1: High-Level System Components**

***Figure 1: High-Level System Architecture***







### **2.2 Hardware/Software Mapping** {#2.2-hardware/software-mapping}

The deployment architecture maps software components to physical/virtual infrastructure.

***Figure 2: Deployment Diagram***



#### *Deployment Specifications* {#deployment-specifications}

**Frontend Deployment:**  

*Platform***:** Vercel (recommended for Next.js) or AWS Amplify / self-hosted containers 	*Configuration***:** Multiple instances behind load balancer for high availability

*Build***:** Server-side rendering (SSR) for dynamic pages, static generation (SSG) for landing/marketing pages, optimized bundle size with code splitting

**Backend Deployment:** 

*Platform***:** AWS ECS / GCP Cloud Run / Azure Container Instances 

*Configuration***:** Minimum 2 instances for high availability, horizontal auto-scaling health check endpoints configured, environment variables for secrets management *Database Connections:* Connection pooling (max 100 connections), read replica for analytics queries, automated failover configuration

**Database Deployment:** 

*Platform***:** AWS RDS PostgreSQL / Google Cloud SQL / Azure Database for PostgreSQL

*Configuration***:** Multi-AZ deployment for high availability, automated daily backups with 30-day retention, point-in-time recovery enabled, encryption at rest and in transit, monitoring and alerting configured 

*Performance***:** Optimized instance size (db.m5.2xlarge or equivalent), SSD storage with provisioned IOPS, query performance insights enabled



# **3 Object Model**

## **3.1 Class Diagram**

The class diagram represents the structure of the MindEase system showing classes, attributes, operations, and relationships.

***Figure 3: Overall Class Diagram***



***Figure 4: Assessment Class Diagram***





***Figure 5: User Mgmt, Session Management and Comms*** 



***Figure 6: Resources & Badges System***

### **Key Design Patterns in Class Structure**

**1 Repository Pattern:** Each entity has a corresponding repository class for data access abstraction.

**2 Service Layer Pattern:** Business logic encapsulated in service classes that orchestrate repository operations.

**3 Encryption Pattern:** Sensitive data (messages, notes, emails) encrypted at the model level.

**4 Soft Delete Pattern:** Records marked as deleted rather than physically removed for data recovery.



## **3.2 Sequence Diagrams**

Sequence diagrams illustrate how system components interact over time for key use cases.

### **3.2.1 User Authentication Sequence**

***Figure 7: Authentication Sequence Diagram***





### **3.2.2 Chat Session Sequence**

***Figure 8: Chat Session Sequence Diagram***









### **3.2.3 Mood Tracking Sequence**

***Figure 9: Mood Tracking Sequence Diagram***

 











### **3.2.4 Avatar Session Sequence**

***Figure 10: Avatar Session Sequence Diagram***



## **3.3 State Chart Diagrams** {#3.3-state-chart-diagrams}

State charts illustrate the different states an object can be in and the transitions between those states. For MindEase, critical objects with complex state management include **Conversation Sessions**, **User Authentication**, and **Crisis Alert** processes.

***Figure 11: Conversation State chart***



***Figure 12:User Authentication State Chart***



# **4 Detailed System Design**

## **4.1 Authentication Service (Auth Service)** {#4.1-authentication-service-(auth-service)}

### **4.1.1 Overview** {#4.1.1-overview}

The Authentication Service manages user registration, login, session management, and authorization. It supports both Google OAuth 2.0 and traditional email/password authentication with JWT-based session management.

### **4.1.2 Component Architecture** {#4.1.2-component-architecture}

***Figure 13:Auth Component Architecture***







### **4.1.3 Database Schema** {#4.1.3-database-schema}

***Table 2: Users Database Schema***


| Column Name   | Data Type    | Constraints      | Description                                   |
| ------------- | ------------ | ---------------- | --------------------------------------------- |
| userid        | UUID         | PRIMARY KEY      | Unique user identifier                        |
| email         | VARCHAR(255) | UNIQUE, NOT NULL | User email address                            |
| passwordhash  | VARCHAR(255) | NULL             | Bcrypt hashed password (null for OAuth users) |
| fullname      | VARCHAR(255) | NOT NULL         | User's full name                              |
| oauthprovider | VARCHAR(50)  | NULL             | OAuth provider (google, null for email)       |
| oauthid       | VARCHAR(255) | NULL             | Provider's user ID                            |
| isverified    | BOOLEAN      | DEFAULT FALSE    | Email verification status                     |
| createdat     | TIMESTAMP    | DEFAULT NOW()    | Account creation timestamp                    |
| updatedat     | TIMESTAMP    | DEFAULT NOW()    | Last update timestamp                         |
| lastlogin     | TIMESTAMP    | NULL             | Last successful login                         |




### **4.1.4 Authentication Flow  Google OAuth** {#4.1.4-authentication-flow---google-oauth}

***Figure 14: Authentication Flow***



## **4.2 Chat Service** {#4.2-chat-service}

### **4.2.1 Overview** {#4.2.1-overview}

The Chat Service manages real-time conversations between users and the AI mental health assistant. It handles message persistence, WebSocket connections, conversation history, and integration with the MentalLama AI/NLP microservice.

### **4.2.2 Component Architecture** {#4.2.2-component-architecture}

***Figure 14: Chat Service Architecture***



### **4.2.3 Database Schema** {#4.2.3-database-schema}

***Table 3 Chat Database Schema***


| Column Name    | Data Type    | Constraints                   | Description                         |
| -------------- | ------------ | ----------------------------- | ----------------------------------- |
| conversationid | UUID         | PRIMARY KEY                   | Unique conversation identifier      |
| userid         | UUID         | FOREIGN KEY (users), NOT NULL | Associated user                     |
| title          | VARCHAR(255) | NULL                          | Conversation title (auto-generated) |
| startedat      | TIMESTAMP    | DEFAULT NOW()                 | Conversation start time             |
| lastmessageat  | TIMESTAMP    | DEFAULT NOW()                 | Last message timestamp              |
| status         | VARCHAR(50)  | DEFAULT 'active'              | active, ended, archived             |
| totalmessages  | INTEGER      | DEFAULT 0                     | Message count                       |
| crisisdetected | BOOLEAN      | DEFAULT FALSE                 | Crisis flag                         |
| updatedat      | TIMESTAMP    | DEFAULT NOW()                 | Last update timestamp               |
| lastlogin      | TIMESTAMP    | NULL                          | Last successful login               |


### **4.2.4 Real-time Chat Flow with AI Integration** {#4.2.4-real-time-chat-flow-with-ai-integration}

***Figure 15: Realtime chat flow***



### **4.2.5 WebSocket Connection Management** {#4.2.5-websocket-connection-management}

***Figure 16: Websocket connection management***





## **4.3 AI/NLP Microservice (MentalLama Model)**  {#4.3-ai/nlp-microservice-(mentallama-model)}

### **4.3.1 Overview** {#4.3.1-overview}

 The AI/NLP Microservice is a standalone Python FastAPI service that hosts the fine-tuned MentalLlama model. It provides therapeutic conversation generation, sentiment analysis, and crisis detection capabilities using a LoRA-adapted Llama 3.1 8B base model. 

### **4.3.2 Component Architecture** {#4.3.2-component-architecture}

***Figure 17: AI/NLP component architecture***



### **4.3.3 Model Fine Tuning Pipeline** {#4.3.3-model-fine-tuning-pipeline}

***Figure 18:Fine tuning pipeline***



## **4.4 Mood Service** {#4.4-mood-service}

### **4.4.1 Overview** {#4.4.1-overview}

The Mood Service manages mood tracking, trend analysis, and pattern detection. It allows users to log their emotional state, view historical trends, and receive insights about their mental health patterns.

### **4.4.2 Component Architecture** {#4.4.2-component-architecture}

***Figure 19: Mood Service architecture***



### **4.4.3Mood Entry Flow** {#4.4.3mood-entry-flow}

***Figure 20: Mood Entry Flow***



# **5 Use case diagrams** {#5.-use-case-diagrams}

## **5.1 New User Registration and First Chat** {#5.1-new-user-registration-and-first-chat}





## **5.2 Guest User Session** {#5.2-guest-user-session}



## **5.3 Daily Mood Check-in** {#5.3-daily-mood-check-in}



## **5.4 Crisis Intervention** {#5.4-crisis-intervention}



## **5.5 Therapist Avatar Session** {#5.5-therapist-avatar-session}





## **5.6 Self-Assessment Completion** {#5.6-self-assessment-completion}





## **5.7 Data Export** {#5.7-data-export}





# **6 References** {#6.-references}



## **Technical Bibliography & Reference Table** {#technical-bibliography-&-reference-table}

***Table 4: Technical Bibliography***


| Category         | Reference Name                                                             | Key Use in MindEase                                           | Type / Source                                                                                                 |
| ---------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Frontend**     | *Practical Next.js 14* (Schmitz, 2024/25)                                  | Implementing App Router, SSR, and PWA logic.                  | Book / Leanpub                                                                                                |
| **Backend**      | *Ultimate Guide to FastAPI* (Hynkova, 2025                                 | Async API design and Pydantic v2 data validation.             | Technical Guide                                                                                               |
| **AI / NLP**     | *A Systematic Evaluation of LLM Strategies for Mental Health* (arXiv, 2025 | Validating Fine-tuning vs RAG for 91% emotion accuracy.       | [Research Paper](https://arxiv.org/html/2503.24307v1)                                                         |
| **AI / NLP**     | *Fine-Tuning Llama 3.1 for Sentiment Analysis* (DataCamp, 2024             | Implementing LoRA adapters and bitsandbytes quantization.     | [Tutorial](https://www.datacamp.com/tutorial/fine-tuning-llama-3-1)                                           |
| **Clinical**     | *PHQ-9 & GAD-7 Management Guidelines* (Dr. Oracle, 2025                    | Logic for the "Crisis Detection" and "Mood Scoring" triggers. | [Clinical Standard](https://uhs.fsu.edu/sites/g/files/upcbnu1651/files/docs/PHQ-9%20and%20GAD-7%20Form_a.pdf) |
| **Database**     | *SQLAlchemy 2.0 Unified Documentation*                                     | Mapping the Object-Relational Model for PostgreSQL.           | [Official Docs](https://docs.sqlalchemy.org/en/20/)                                                           |
| **Architecture** | *Clean Architecture* (Robert C. Martin)                                    | Layered subsystem decomposition and SOLID logic.              | Book / Pearson                                                                                                |
| **Architecture** | *Microservices Patterns, 2nd Edition* (Richardson, 2025                    | Designing the independent NLP Microservice scaling.           | Book / Manning                                                                                                |


## {#heading}

## **Critical Online Resources**

- **Llama 3.1 Model Card:** Meta AI’s official release notes for the 8B-It model, focusing on therapeutic safety and dialogue capabilities.  
- **Next.js App Router Documentation:** Specifically the sections on **Server Actions** and **Streaming**, which MindEase uses for the chat UI.  
- **FastAPI Documentation (FastAPI.tiangolo.com):** The "Holy Grail" for your backend's WebSocket and Dependency Injection implementation.

