package com.paritosh.cheapchats.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.paritosh.cheapchats.models.ChatGroup;
import com.paritosh.cheapchats.models.User;
import com.paritosh.cheapchats.repositories.ChatGroupRepository;
import com.paritosh.cheapchats.repositories.UserRepository;
import com.paritosh.cheapchats.services.GroupService;

import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true") // Allow all origins for CORS
// This allows the frontend to communicate with the backend without CORS issues
@Slf4j
public class GroupController {

    @Autowired
    private GroupService groupService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ChatGroupRepository chatGroupRepository;

    // LOGIN
    @PostMapping("/login")
    public Map<String, String> login(@RequestParam String username) {

        // Check if the user already exists
        // If not, create a new user with a unique session ID
        if (!userRepository.existsById(username)) {

            User user = new User();

            // Generate a unique session ID for the user
            // This session ID can be used to identify the user in the chat system
            user.setUserName(username);
            user.setSessionId(UUID.randomUUID().toString());

            // save changes
            userRepository.save(user);

        }

        // log user login
        log.info("LOGIN: User: {}", username);

        // If the user already exists, return the user
        return Map.of("status", "ok", "username", username);

    }

    // CREATE GROUP
    @PostMapping("/group")
    public ChatGroup createGroup(
            @RequestParam String groupName,
            @RequestParam String createdBy,
            @RequestParam(defaultValue = "60") int expiryInMinutes
    ) {
        return groupService.createChatGroup(groupName, createdBy, expiryInMinutes);
    }

    // Exception handler for IllegalArgumentException
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        if (ex.getMessage() != null && ex.getMessage().contains("already exists")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Group with this name already exists."));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }

    // GET GROUP
    @GetMapping("/group/{groupName}")
    public ChatGroup getGroup(@PathVariable String groupName) {
        return groupService.getGroupByName(groupName);
    }

    // GET GROUP EXPIRY TIME
    @GetMapping("/group/{groupName}/expiresIn")
    public ResponseEntity<Map<String, Object>> getGroupExpiryIn(@PathVariable String groupName) {

        log.info("inside controller getGroupExpiryIn");

        try {
            ChatGroup group = groupService.getGroupByName(groupName);
            Integer minsLeft = Integer.valueOf(group.getExpiresIn());
            boolean isExpired = group.isExpired();

            log.info("fetched expiry mins: {}", minsLeft);

            return ResponseEntity.ok(Map.of(
                    "minsLeft", minsLeft,
                    "isExpired", isExpired
            ));

        } catch (NumberFormatException e) {
            log.error("Error getting group expiry time: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", -1));
        }

    }

    // JOIN GROUP
    @PostMapping("/group/{groupName}/join")
    public ResponseEntity<ChatGroup> joinGroup(
            @PathVariable String groupName,
            @RequestParam String username
    ) {

        if (groupName == null) {
            return ResponseEntity.badRequest().build();
        }
        return groupService.joinChatGroup(groupName, username)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());

    }

    // LEAVE GROUP
    @PostMapping("/group/{groupName}/leave")
    public Map<String, String> leaveGroup(
            @PathVariable String groupName,
            @RequestParam String username
    ) {

        boolean success = groupService.leaveChatGroup(groupName, username);

        return Map.of("left", String.valueOf(success));

    }

    // Check for existing group name
    @GetMapping("/group/{groupName}/checkName")
    public ResponseEntity<Map<String, Boolean>> checkGroupNameExists(@PathVariable String groupName) {

        boolean exists = chatGroupRepository.existsByGroupName(groupName);

        return ResponseEntity.ok(Map.of("exists", exists));

    }

    // List all groups for a user (not expired)
    @GetMapping("/groups")
    public List<ChatGroup> getUserGroups(@RequestParam String username) {

        List<ChatGroup> allGroups = groupService.getGroupsForUser(username);
        return allGroups;

    }

    // UPDATE GROUP SETTINGS
    @PutMapping("/group/{groupName}/settings")
    public Map<String, String> updateGroupInfo(@PathVariable String groupName, @RequestBody String jsonBody) {

        log.info("inside controller updateGroupInfo");

        JSONObject groupSettingsJson = new JSONObject(jsonBody);

        boolean success = groupService.updateGroupInfo(groupName.trim(), groupSettingsJson.getString("newGroupName"), groupSettingsJson.getInt("newExpiryMinutes"));

        return Map.of("updated", String.valueOf(success));
    }

    // REMOVE MEMBER
    @DeleteMapping("/group/{groupName}/remove")
    public ResponseEntity<?> removeMember(
            @PathVariable String groupName,
            @RequestParam String targetMember
    ) {

        log.info("inside controller removeMember");

        groupService.removeMember(groupName, targetMember);

        return ResponseEntity.ok(Map.of("removed", true));

    }

    // Delete a group (admin only)
    @DeleteMapping("/group/{groupName}")
    public ResponseEntity<?> deleteGroup(@PathVariable String groupName, @RequestParam String username) {

        log.info("inside controller deleteGroup");

        ChatGroup group = groupService.getGroupByName(groupName);

        if (group == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Group not found"));
        }

        boolean isAdmin = username != null && group.getCreatedBy().equals(username);

        if (!group.isExpired() && !isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Only admin can delete the group"));
        }

        groupService.deleteGroup(groupName);

        return ResponseEntity.ok(Map.of("deleted", true));
    }

}
