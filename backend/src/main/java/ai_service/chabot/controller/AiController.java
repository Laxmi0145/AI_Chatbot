package ai_service.chabot.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.ai.chat.client.ChatClient;
import reactor.core.publisher.Flux;
import ai_service.chabot.entity.ChatRequest;

// Optional (only if you want to set anti-buffering headers)
// import org.springframework.http.server.reactive.ServerHttpResponse;
// import java.time.Duration;

@RestController
@RequestMapping("/ai")
public class AiController {

    private final ChatClient chatClient;

    // Simple templates used by the prompt below
    private final String systemMessage = "You are a concise, helpful assistant for developers.";
    private final String userMessage   = "Explain the concept: {concept}";

    // Spring AI autoconfigures a ChatClient.Builder; build once and reuse
    public AiController(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    @PostMapping(value = "/stream", consumes = "application/json", produces = "text/plain")
	
	public Flux<String> streamPost(@RequestBody ChatRequest body, ServerHttpResponse response) {

        String query = body != null && body.getMsg() != null ? body.getMsg().trim() : "";
        if (query.isEmpty()) {
            return Flux.just("Please send a non-empty 'msg' in JSON body.");
        }


        return chatClient.prompt()
		.system(system->system.text(this.systemMessage))
		.user(user->user.text(this.userMessage).param("concept", query))
        .stream()
		.content();

    }
	
}