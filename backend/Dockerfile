# Use lightweight Java 21 JDK image
FROM eclipse-temurin:21-jdk-alpine

# Set working directory
WORKDIR /app

# Copy Maven wrapper and pom.xml first (for dependency caching)
COPY .mvn/ .mvn
COPY mvnw pom.xml ./

# Make sure mvnw is executable (in case Git chmod didn’t carry over)
RUN chmod +x mvnw

# Pre-fetch dependencies (so later builds are faster)
RUN ./mvnw -q dependency:go-offline

# Copy application source code
COPY src ./src

# Build and rename jar to app.jar
RUN ./mvnw -q -DskipTests package && cp target/*.jar app.jar

# Expose app port (Render maps $PORT automatically)
EXPOSE 8080

# Run the app, letting Render inject $PORT
CMD ["java", "-jar", "app.jar", "--server.port=${PORT}"]
